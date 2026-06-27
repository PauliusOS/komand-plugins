#!/usr/bin/env node
/**
 * Regenerates `index.json` AND the per-plugin install tarballs in `tarballs/`
 * from the plugin manifests in `plugins/`.
 *
 * Usage:
 *   node scripts/generate-index.mjs
 *
 * Run after editing any plugin's `.codex-plugin/plugin.json` (especially
 * after a version bump), or after adding/removing a plugin. The output
 * (`index.json` + `tarballs/*.tar.gz`) is committed to the repo and is
 * what Komand reads to discover and install plugins.
 *
 * URL conventions:
 *   - tarballUrl: a PER-PLUGIN gzipped tarball served from jsDelivr's CDN
 *     (no GitHub rate limits, edge-cached, CORS-friendly). Each tarball is
 *     tiny — only that plugin's files — so installing one plugin no longer
 *     downloads the whole repo. The archive is laid out as
 *     `komand-plugins/plugins/<name>/...` so the existing Komand installer
 *     (which expects `<topDir>/<tarballSubpath>`) keeps working unchanged
 *     with `tarballSubpath: "plugins/<name>"`.
 *   - iconUrl: jsDelivr CDN of the icon.
 *
 * Tarballs are built reproducibly (fixed mtime + `gzip -n`, sorted entries)
 * so re-running the script produces byte-identical archives when nothing
 * changed — no spurious git churn.
 */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const pluginsDir = path.join(repoRoot, 'plugins')
const tarballsDir = path.join(repoRoot, 'tarballs')

// CHANGE THESE if you fork or rename the repo.
const GH_USER = 'PauliusOS'
const GH_REPO = 'komand-plugins'
const GH_REF = 'main'

// touch -t format (CCYYMMDDhhmm) — pinned so tarball bytes are stable.
const FIXED_MTIME = '202601010000'

const cdnFile = (...segments) =>
    `https://cdn.jsdelivr.net/gh/${GH_USER}/${GH_REPO}@${GH_REF}/${segments.join('/')}`

function readManifest(pluginDir) {
    const codex = path.join(pluginDir, '.codex-plugin', 'plugin.json')
    const claude = path.join(pluginDir, '.claude-plugin', 'plugin.json')
    const file = fs.existsSync(codex) ? codex : claude
    if (!fs.existsSync(file)) return null
    return JSON.parse(fs.readFileSync(file, 'utf-8'))
}

function findIcon(pluginDir, name) {
    const assetsDir = path.join(pluginDir, 'assets')
    if (!fs.existsSync(assetsDir)) return null
    const files = fs.readdirSync(assetsDir)
    const exts = ['.svg', '.png', '.webp', '.jpg', '.jpeg']
    for (const ext of exts) {
        const match = files.find((f) => f.toLowerCase().endsWith(ext))
        if (match) return path.join('plugins', name, 'assets', match)
    }
    return null
}

/**
 * Build `tarballs/<name>.tar.gz` containing the plugin laid out as
 * `komand-plugins/plugins/<name>/...`. Reproducible: pinned mtime, sorted
 * entries, `gzip -n` (no embedded filename/timestamp).
 */
function buildTarball(name) {
    const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'kp-tar-'))
    try {
        const inner = path.join(stage, 'komand-plugins', 'plugins')
        fs.mkdirSync(inner, { recursive: true })
        execFileSync('cp', ['-R', path.join(pluginsDir, name), inner])
        // Normalize every entry's mtime for reproducibility.
        execFileSync(
            'find',
            ['komand-plugins', '-exec', 'touch', '-t', FIXED_MTIME, '{}', '+'],
            { cwd: stage }
        )
        const out = path.join(tarballsDir, `${name}.tar.gz`)
        // Sorted, null-delimited file list → deterministic order; gzip -n
        // drops the timestamp/name so unchanged input → identical bytes.
        const gz = execFileSync(
            'bash',
            [
                '-c',
                // -type f only: feeding dirs to `tar -T` makes BSD tar
                // recurse them AND re-add each file → duplicated content.
                'find komand-plugins -type f -print0 | LC_ALL=C sort -z | ' +
                    'tar --null -cf - -T - | gzip -n'
            ],
            { cwd: stage, maxBuffer: 1 << 28 }
        )
        fs.writeFileSync(out, gz)
    } finally {
        fs.rmSync(stage, { recursive: true, force: true })
    }
}

// Rebuild the tarballs dir from scratch so removed plugins don't leave
// orphaned archives behind.
fs.rmSync(tarballsDir, { recursive: true, force: true })
fs.mkdirSync(tarballsDir, { recursive: true })

const entries = fs
    .readdirSync(pluginsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => {
        const pluginDir = path.join(pluginsDir, d.name)
        const manifest = readManifest(pluginDir)
        if (!manifest) {
            console.warn(`[generate-index] no manifest in ${d.name}, skipping`)
            return null
        }
        const iface = manifest.interface || {}
        const iconRel = findIcon(pluginDir, d.name)
        buildTarball(d.name)
        return {
            name: manifest.name,
            version: manifest.version,
            displayName: iface.displayName || manifest.displayName || manifest.name,
            description:
                iface.shortDescription || manifest.description || '',
            longDescription:
                iface.longDescription || manifest.longDescription || null,
            author: manifest.author || null,
            homepage: manifest.homepage || null,
            repository: manifest.repository || null,
            license: manifest.license || 'MIT',
            keywords: manifest.keywords || [],
            category: iface.category || manifest.category || 'Coding',
            brandColor: iface.brandColor || manifest.brandColor || null,
            iconUrl: iconRel ? cdnFile(iconRel) : null,
            tarballUrl: cdnFile('tarballs', `${d.name}.tar.gz`),
            tarballSubpath: `plugins/${d.name}`,
            isOfficial: true
        }
    })
    .filter(Boolean)
    // Stable sort: alpha by name
    .sort((a, b) => a.name.localeCompare(b.name))

const index = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    plugins: entries
}

const out = path.join(repoRoot, 'index.json')
fs.writeFileSync(out, JSON.stringify(index, null, 2) + '\n')
console.log(
    `[generate-index] wrote ${entries.length} plugin(s) to ${out} ` +
        `and ${entries.length} tarball(s) to ${tarballsDir}`
)
