# Komand's embedded iPhone preview

Komand ships a live, interactive iPhone rendered inside its right-side
iOS tab — no Simulator.app window involved. A Swift sidecar (`simstream`)
streams the iOS Simulator's framebuffer over a local WebSocket, and
mouse/keyboard input flows back as real HID touches. Glass-to-glass
latency is ~50–100 ms.

For the full architecture, see `docs/ios-sim.md` in the main Komand repo.
This file is a skill-scoped cheat sheet.

## You don't fire the preview — Komand does

When this plugin is installed, Komand registers a post-hook on the
XcodeBuildMCP server's `launch_app_sim` and `install_app_sim` tools.
After either tool succeeds, Komand's server-side code:

1. Extracts the UDID from the tool args (or from the currently-booted sim)
2. Writes `~/Library/Application Support/ai.clonk.app/ios-preview-trigger.json`
3. A Rust watcher polls that file every 500 ms, emits a Tauri event,
   deletes the file
4. The frontend opens the right-side panel, flips to the iOS tab, and
   starts streaming

From the agent's perspective: you call `launch_app_sim`, it succeeds,
the preview appears. No explicit trigger step; the SKILL.md workflow
ends at `launch_app_sim`.

You can confirm the hook fired by looking at Komand's Tauri dev log:

```
[MCP hook] komand_ios_preview_trigger: fired for udid=<UDID> (via launch_app_sim)
```

The hook is wired in `server/mcp/hooks.js`; configuration lives in the
plugin's `.mcp.json` under the `postHooks` field.

## Blocked tools

Komand's MCP layer removes these XcodeBuildMCP tools from the list
exposed to the agent — they pop Apple's Simulator.app, which Komand's
embedded preview replaces:

- `build_run_sim`
- `build_run_device`
- `open_sim`
- `boot_sim`

You won't see them in the tool list. Use `build_sim` +
`install_app_sim` + `launch_app_sim` instead. `install_app_sim` boots
the device internally, so `boot_sim` is never needed.

Blocking happens in `server/mcp/index.js` via the `blockTools` field
in the plugin's `.mcp.json`.

## Architecture cheat-sheet

```
agent  →  mcp__XcodeBuildMCP__launch_app_sim  →  Komand MCP proxy
                                                       │
                                 ┌─────────────────────┤
                                 ▼                     ▼
                      XcodeBuildMCP server      post-hook (hooks.js)
                      (xcrun simctl launch)     writes trigger file
                                                       │
                                                       ▼
                                          Rust watcher (ios_simulator.rs)
                                                       │
                                                       ▼
                                          Tauri event → frontend
                                                       │
                                                       ▼
                                          Open panel + stream UDID
```

## Behavior to rely on

- **No Simulator.app window.** Komand's preview replaces it. If a
  window appears, something external launched it; `pkill -9 Simulator`.
- **Headless boot.** `install_app_sim` boots the device if it's shut
  down — no manual `boot_sim` or `simctl boot` step required.
- **Hook is fire-and-forget.** Runs in the background after the tool
  call completes; never blocks the tool result, never throws — a
  failing hook writes to the dev log and the launch still succeeds.
- **Ambiguous UDID = no trigger.** If the hook can't determine which
  sim to stream (no `simulatorId` arg, no session default, multiple
  sims booted) it skips the trigger and logs. Pass `simulatorId`
  explicitly or use `session_set_defaults` to avoid ambiguity.
- **Hardware buttons and taps drive via Komand's own HID path** once
  the preview is up. For scripted UI interaction during tests, prefer
  XcodeBuildMCP's `tap` / `type_text` / `gesture` / `describe_ui` —
  deterministic + returns accessibility data, and operates on the same
  underlying simulator so you see the taps land live in the preview.

## Troubleshooting

| Symptom                           | Likely cause                                                               | Fix                                                                                                                |
| --------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Preview doesn't open after launch | Hook couldn't resolve UDID                                                 | Call `session_set_defaults` with `simulatorId` before `launch_app_sim`                                             |
| Simulator.app still pops up       | Something else on the machine launched it                                  | `pkill -9 Simulator`; agent isn't calling `open -a Simulator`                                                      |
| Preview stuck on black screen     | Transient simstream cold-launch (Gatekeeper signature validation)          | Wait ~20 s; frontend auto-retries + auto-respawns                                                                  |
| Hook not firing                   | Plugin not installed, or installed with wrong id                           | Skills tab → Plugins — confirm "Build iOS Apps (Komand)" is installed; look for `[MCP hook]` line in Tauri dev log |
| Preview shows wrong device        | UDID ambiguous + hook fell back to booted-sim heuristic with multiple sims | Always use `session_set_defaults` with a specific `simulatorId`                                                    |

## Manual trigger (last resort)

The hook covers the normal case. If you need to fire the preview
manually (e.g. debugging plumbing) write the trigger file directly:

```bash
mkdir -p "$HOME/Library/Application Support/ai.clonk.app"
printf '{"udid":"%s"}\n' "$UDID" \
    > "$HOME/Library/Application Support/ai.clonk.app/ios-preview-trigger.json"
```

Same effect as the auto-hook. The plugin also ships
`scripts/komand-ios` as a shell wrapper for the same thing; use it if
you're running commands outside an agent session.

## What the preview does NOT do

- **No audio.** Headless iOS renders no audio in Simulator-less mode.
- **No hardware keyboard passthrough.** Mac keystrokes don't forward
  yet — use XcodeBuildMCP's `type_text` for text input.
- **No Action button.** iPhone 15/17 Pro's Action button isn't wired.
- **iPhone only.** iPad / Apple Watch / Apple TV simulator types
  aren't surfaced yet.
