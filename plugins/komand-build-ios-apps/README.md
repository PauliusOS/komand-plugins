# Build iOS Apps (Komand) — `komand-build-ios-apps`

Komand's bundled plugin for iOS and SwiftUI workflows — originally
derived from the OpenAI Codex desktop plugin `build-ios-apps`,
substantially rewritten to drive Komand's embedded iPhone preview
instead of Apple's Simulator.app window.

The plugin id is `komand-build-ios-apps` (not `build-ios-apps`) so it
can coexist with the OpenAI Codex marketplace version without
collision. Install this one from Komand's Skills tab → Plugins →
Available to Install.

Skills included:

- `ios-debugger-agent` — build, run, and surface the app inside Komand's iPhone preview
- `ios-app-intents` — App Intents, App Entities, App Shortcuts
- `swiftui-liquid-glass` — iOS 26+ Liquid Glass APIs
- `swiftui-performance-audit` — SwiftUI runtime performance review
- `swiftui-ui-patterns` — SwiftUI composition + component patterns
- `swiftui-view-refactor` — view splitting, MV-over-MVVM, stable view trees

## What makes this version different

The original Codex plugin used `XcodeBuildMCP` to build and interact
with a simulator rendered in Apple's Simulator.app. Komand ships its
own streaming iOS preview (see `docs/ios-sim.md`) — a live, interactive
iPhone embedded inside Komand's right-side iOS tab, backed by a Swift
sidecar streaming H.264 over a local WebSocket.

This plugin wires XcodeBuildMCP into that preview via two
MCP-layer extensions in `.mcp.json`:

- **`blockTools`** — removes tools that would pop Apple's Simulator.app
  (`build_run_sim`, `build_run_device`, `open_sim`, `boot_sim`) from
  the tool list exposed to agents. They're not hidden by convention —
  they don't exist from the agent's perspective.
- **`postHooks`** — after `launch_app_sim` or `install_app_sim`
  succeeds, Komand's MCP proxy writes the preview-trigger file
  automatically. The agent never needs to remember a separate
  "surface the preview" step.

Build/install/launch/UI-inspection/logs all go through XcodeBuildMCP —
just with the tool set trimmed and the trigger automated.

## Plugin layout

```
plugins/komand-build-ios-apps/
├── .codex-plugin/plugin.json        # plugin manifest (name: komand-build-ios-apps)
├── .mcp.json                        # MCP wiring — includes blockTools + postHooks
├── agents/openai.yaml               # plugin-level agent metadata
├── scripts/komand-ios               # shell wrapper (humans; skills don't use it)
├── skills/                          # individual skill payloads
│   ├── ios-debugger-agent/          # build + install + launch (preview is automatic)
│   ├── ios-app-intents/
│   ├── swiftui-liquid-glass/
│   ├── swiftui-performance-audit/
│   ├── swiftui-ui-patterns/
│   └── swiftui-view-refactor/
└── README.md
```

## How the preview trigger works

No longer lives in the skill prose — lives in Komand's MCP proxy:

```
agent calls launch_app_sim
         │
         ▼
XcodeBuildMCP runs xcrun simctl launch           ← tool result
         │
         ▼
Komand MCP proxy sees postHook match             ← hooks.js
         │
         ▼
Writes ~/Library/Application Support/ai.clonk.app/ios-preview-trigger.json
         │
         ▼
Rust watcher in ios_simulator.rs polls, emits Tauri event
         │
         ▼
Frontend opens right panel → iOS tab → streams UDID
```

The agent's workflow ends at `launch_app_sim`. The preview appearing
is an invariant, not a reminder the agent has to carry.

## For humans running commands manually

`scripts/komand-ios show <UDID>` is a shell wrapper for the manual
trigger path (writes the same trigger file + fires a deep link). Use
it if you're debugging plumbing outside an agent session.
