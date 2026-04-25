---
name: ios-debugger-agent
description: Build, run, and debug the current iOS project inside Komand's embedded iPhone preview. Use XcodeBuildMCP for build/install/launch/logs/UI interaction. The preview opens automatically when you launch an app — you don't need to do any extra trigger work.
---

# iOS Debugger Agent

Build, install, and launch the current iOS app. Komand's embedded iPhone
preview will surface the running app automatically — the simulator
launch itself fires the preview. No separate trigger step required.

## Scaffolding a new project

**If you're creating an iOS app from scratch** (not modifying an existing
Xcode project), read `references/ios-new-project-checklist.md` before
writing any files. It gives you a minimal Info.plist template,
required `.pbxproj` build settings, a SwiftUI `App` skeleton, and a
post-build validation step.

The most common failure mode when agents scaffold iOS apps: a missing
`UILaunchScreen` key causes iOS to render the app in "compatibility
mode" — small, letterboxed, centered on the phone screen. The
checklist prevents that and four other common issues. Don't reinvent
the Info.plist — copy the template verbatim and tweak from there.

## Core workflow

### 1) Pick a simulator UDID

```
mcp__XcodeBuildMCP__list_sims   →  pick a device, save its UDID as $UDID
```

Prefer one that's already `Booted`. If none are, pick any reasonable
iPhone sim — `install_app_sim` boots it before installing.

### 2) Set session defaults

```
mcp__XcodeBuildMCP__session-set-defaults:
  projectPath or workspacePath
  scheme
  simulatorId: <UDID>
  configuration: "Debug"
```

If you don't know the scheme, call
`mcp__XcodeBuildMCP__list_schemes` first.

### 3) Build

```
mcp__XcodeBuildMCP__build_sim
```

Fix any compile errors and retry until it passes. Do not bail to raw
`xcodebuild` unless the MCP path is genuinely broken.

### 4) Install + launch

```
mcp__XcodeBuildMCP__get_sim_app_path         → APP_PATH
mcp__XcodeBuildMCP__get_app_bundle_id        → BUNDLE_ID
mcp__XcodeBuildMCP__install_app_sim
mcp__XcodeBuildMCP__launch_app_sim
```

That's it. Komand detects the `install_app_sim` / `launch_app_sim` call
and surfaces the running simulator inside its iOS tab — the right-side
panel opens, flips to the iPhone preview, and starts streaming. You
don't need to write any trigger file or run any extra command.

The stream takes 5–20 s to come up on first launch (sidecar warmup).
That's normal; don't retry or try to "fix" it.

## UI interaction + logs

XcodeBuildMCP's UI tools operate on the same simulator Komand is
streaming, so the user sees your taps land live in the preview:

- `mcp__XcodeBuildMCP__describe_ui` — accessibility tree before tap/type
- `mcp__XcodeBuildMCP__tap` — prefer id/label over coords
- `mcp__XcodeBuildMCP__type_text` — focus a field first
- `mcp__XcodeBuildMCP__gesture` — scrolls, edge swipes
- `mcp__XcodeBuildMCP__screenshot` — transcript snapshot

Logs:

- `mcp__XcodeBuildMCP__start_sim_log_cap` with the bundle id
- `mcp__XcodeBuildMCP__stop_sim_log_cap` to summarize

## Troubleshooting

- **Komand preview doesn't show** → verify you actually called
  `install_app_sim` or `launch_app_sim` and that it returned success.
  The auto-trigger only fires on successful launch/install. Check
  Komand's Tauri dev log for `[MCP hook] komand_ios_preview_trigger`.
- **Build fails** → read the error, fix it, retry with the same MCP
  tool. Don't fall back to raw `xcodebuild` as a workaround.
- **Wrong app launches** → verify the scheme and bundle id from
  `get_app_bundle_id`.
- **Stream black after launch** → transient sidecar warmup. Wait
  ~20 s. If still black, Stop+Start in Komand's iOS tab toolbar.

## Notes on the Komand integration

Komand filters XcodeBuildMCP's tool list — `build_run_sim`,
`build_run_device`, `open_sim`, and `boot_sim` are not exposed because
they pop Apple's Simulator.app, which Komand's embedded preview
replaces. You won't see them in your tool list; that's expected. Use
`build_sim` + `install_app_sim` + `launch_app_sim` instead.

Komand also registers an auto-hook on `install_app_sim` /
`launch_app_sim` that writes its preview-trigger file server-side.
That's why no explicit trigger step appears in the workflow above.

## Reference

- `references/komand-ios-preview.md` — how the preview is wired
  (trigger file, Tauri events, simstream sidecar, auto-hook)
- `docs/ios-sim.md` in the main repo — full architecture
