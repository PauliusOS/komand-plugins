#!/usr/bin/env node
/**
 * Regenerates `index.json` from the plugin manifests in `plugins/`.
 *
 * Usage:
 *   node scripts/generate-index.mjs
 *
 * Run after editing any plugin's `.codex-plugin/plugin.json` (especially
 * after a version bump). The output is committed to the repo and is what
 * Komand reads to discover available plugins.
 *
 * URL conventions:
 *   - tarballUrl: GitHub's codeload tarball of `main`. We always pull the
 *     latest, then extract just the plugin's subpath. Per-plugin
 *     versioning is tracked in this index, not via per-plugin tags.
 *   - iconUrl: jsDelivr CDN of the icon. No GitHub rate limits, fast,
 *     CORS-friendly.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const pluginsDir = path.join(repoRoot, 'plugins')

// CHANGE THESE if you fork or rename the repo.
const GH_USER = 'PauliusOS'
const GH_REPO = 'komand-plugins'
const GH_REF = 'main'

const TARBALL_URL = `https://codeload.github.com/${GH_USER}/${GH_REPO}/tar.gz/refs/heads/${GH_REF}`
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
            tarballUrl: TARBALL_URL,
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
console.log(`[generate-index] wrote ${entries.length} plugin(s) to ${out}`)
