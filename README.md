# Komand Plugins

First-party plugins shipped via [Komand](https://komand.ai). The Komand
desktop app fetches `index.json` from this repo's `main` branch on
session start to discover what's available, and downloads the tarball
of any plugin a user installs.

## Layout

```
komand-plugins/
├── index.json              # canonical plugin index (regenerate with the script)
├── plugins/
│   ├── komand-expo/        # one directory per plugin
│   │   ├── .codex-plugin/plugin.json
│   │   ├── .mcp.json
│   │   ├── README.md
│   │   ├── assets/         # icon + screenshots
│   │   ├── skills/<skill>/SKILL.md
│   │   └── ...
│   └── komand-build-ios-apps/
│       └── ...
└── scripts/
    └── generate-index.mjs  # rebuilds index.json from manifests
```

## Adding / updating a plugin

1. Edit the plugin's source under `plugins/<name>/` — typically
   `.codex-plugin/plugin.json`, a SKILL.md, or `.mcp.json`.
2. If you bumped the version (recommended for any user-visible
   change), regenerate the index:

    ```bash
    node scripts/generate-index.mjs
    ```

3. Commit and push to `main`. Komand picks up the new version
   automatically — users see "Update available" the next time they
   open the Plugins tab. No app release needed.

## How Komand consumes this

- **Discovery:** GET `https://raw.githubusercontent.com/<owner>/komand-plugins/main/index.json`.
  Cached locally with ETag; ~1 KB per plugin.
- **Install:** GET `tarballUrl` (`https://codeload.github.com/.../main`),
  unzip just `tarballSubpath` into
  `~/.claude/plugins/cache/komand-bundled/<name>/<version>/`,
  register in `~/.claude/plugins/installed_plugins.json`.
- **Icons:** served via jsDelivr CDN
  (`https://cdn.jsdelivr.net/gh/<owner>/komand-plugins@main/...`) —
  no GitHub rate limits, edge-cached.

## Versioning

Plugin versions live in the plugin's own `.codex-plugin/plugin.json`
(`version` field) and propagate into `index.json` via the generation
script. We don't use git tags per plugin — `main` is the source of
truth, and the index records each plugin's current version. If a user
has v1.1.0 installed and `index.json` has v1.2.0, the app shows
"Update available".

## Why GitHub instead of a backend?

Plugins are small ( <1 MB each), public, and benefit from
transparency. Hosting on GitHub means:

- Zero backend infrastructure — `git push` ships an update.
- Source is publicly inspectable — users see exactly what they're
  installing.
- Community contributions via PRs.
- jsDelivr CDN serves the tarballs free with no rate limits.

For first-party Komand plugins specifically, this is a better fit
than a database-backed system.

## License

MIT for everything in this repo. Individual plugins may include
their own licenses (e.g., upstream Expo plugin content under MIT,
preserved in `plugins/komand-expo/LICENSE`).
