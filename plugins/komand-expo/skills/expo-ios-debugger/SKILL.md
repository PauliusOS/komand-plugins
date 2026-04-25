---
name: expo-ios-debugger
description: Build, install, launch, and debug the current Expo iOS app inside Komand's embedded iPhone preview. Use XcodeBuildMCP for build/install/launch/logs/UI interaction. The preview opens automatically when you launch — no extra trigger step. Prefer this over `expo run:ios` / `expo start --ios` whenever the user is running inside Komand.
---

# Expo iOS Debugger (Komand)

Build, install, and launch the current Expo app on an iOS simulator.
Komand's embedded iPhone preview surfaces the running app automatically
— the simulator install/launch itself fires the preview. No separate
trigger step, no Simulator.app window.

## Why not `expo run:ios` or `expo start --ios`?

Both of those tools call `open -a Simulator` under the hood — they pop
Apple's native Simulator.app, which sits **outside** Komand's embedded
preview. The app runs, but the user sees it in a floating Mac window
they can't interact with from Komand.

Inside Komand, the right path is **XcodeBuildMCP's build_sim +
install_app_sim + launch_app_sim**. Komand's MCP proxy hooks into those
two tools and fires the preview-trigger file server-side, so the iOS
tab opens and starts streaming the UDID you installed to.

Komand also filters XcodeBuildMCP's tool list: `build_run_sim`,
`build_run_device`, `open_sim`, and `boot_sim` are not exposed —
they'd pop Simulator.app. You won't see them in your tool schema;
that's expected. Use `build_sim` + `install_app_sim` + `launch_app_sim`
instead.

## Core workflow

### 1) Ensure there's a native iOS project

Before the first `prebuild`, confirm `expo-dev-client` is in the
project. Without it the generated `.app` is a standalone release
build that embeds the JS bundle at build time — Metro deep-links have
nothing to connect to and hot reload is silently disabled. Symptom:
the app opens on the bundled JS, `simctl openurl exp+<slug>://...`
appears to do nothing, edits never reflect.

```bash
grep -q '"expo-dev-client"' package.json || npx expo install expo-dev-client
```

Then prebuild if `ios/` doesn't exist:

```bash
npx expo prebuild -p ios
```

This generates `ios/<name>.xcworkspace` + Pods. Skip if `ios/` already
exists and you haven't changed native config. If `app.json`, a config
plugin, or `expo-dev-client` version changed, re-run prebuild.

### 2) Pick a simulator UDID

```
mcp__XcodeBuildMCP__list_sims   →  pick a device, save UDID as $UDID
```

Prefer one that's already `Booted`. If none are, pick any iPhone sim
— `install_app_sim` boots it before installing.

### 3) Set session defaults

```
mcp__XcodeBuildMCP__session-set-defaults:
  workspacePath: "./ios/<name>.xcworkspace"
  scheme:        <same as app name in most Expo projects>
  simulatorId:   <UDID>
  configuration: "Debug"
```

If you don't know the scheme, call
`mcp__XcodeBuildMCP__list_schemes` first. Expo's default scheme is
usually the app name from `app.json` / `expo.name`.

### 4) Build

```
mcp__XcodeBuildMCP__build_sim
```

**Expected first-build time: 60–180 seconds** (CocoaPods install +
full Swift + native-module compile). Subsequent builds are
incremental and take 5–20 s. Komand's MCP config raises the tool
timeout to 5 minutes for this reason — don't interpret slowness as
failure and don't retry the tool call until it either succeeds or
returns an error.

Fix any compile errors and retry until it passes. Do not fall back
to `expo run:ios` or raw `xcodebuild` — the Komand preview hooks
only fire through the MCP tools.

### 5) Install + launch

```
mcp__XcodeBuildMCP__get_sim_app_path     → APP_PATH
mcp__XcodeBuildMCP__get_app_bundle_id    → BUNDLE_ID
```

**Extend session defaults with the bundleId before launching.** The
`session-set-defaults` from step 3 set `workspacePath`, `scheme`,
`simulatorId`, and `configuration` — `launch_app_sim` also requires
`bundleId`. Skipping this step means `launch_app_sim` fails with
"Missing required session defaults" and you have to round-trip to
fix it. Do it in one call:

```
mcp__XcodeBuildMCP__session-set-defaults:
  bundleId: <BUNDLE_ID from get_app_bundle_id>
```

Then install and launch:

```
mcp__XcodeBuildMCP__install_app_sim
mcp__XcodeBuildMCP__launch_app_sim
```

Komand detects the `install_app_sim` / `launch_app_sim` call and
surfaces the running simulator inside its iOS tab — the right-side
panel opens, flips to the iPhone preview, and starts streaming. You
don't need to write any trigger file.

Stream takes 5–20 s to come up on first launch (sidecar warmup).
That's normal; don't retry.

**If `get_app_bundle_id` fails** with "Could not extract bundle ID
from Info.plist": the Info.plist hasn't been fully written yet
(timing race on first build). Wait 2s and retry. If it still fails,
read the bundleId directly from `app.json` (`ios.bundleIdentifier`)
— it's the same value.

### 6) Metro — find it, don't spawn a new one

The app bundle launched in step 5 is a dev client — it fetches JS
from a running Metro bundler. **In a Komand session, Metro is
almost always already running.** When the user opens a project
scaffolded from a Komand template (or any project with a
`serverCommand`), Komand auto-starts `npx expo start --dev-client`
in the chat's terminal pane before you're even invoked. Your job is
to **find that Metro and deep-link the sim to it** — not to start
another one.

Starting a second Metro is the dominant failure mode of this
workflow. `expo start` in a non-interactive shell (backgrounded
with `&` has no TTY) **silently bails on port conflicts** — no
error, no dev server. The agent then reacts by picking another
port and starting again, producing 3–5 zombie Metros, none of
which the dev client connects to because the deep link still
points at the first port.

**Detect existing Metro first — match by the OS-level process CWD,
not by Metro's HTTP responses.** Multiple Metros from other Expo
projects commonly hold 8081–8085. The dev-client deep link scheme
(`exp+<slug>://`) enforces which APP opens the link, but whatever
Metro responds at the `url=...` param is what the app loads.
Deep-linking to a running-but-wrong-project Metro silently loads
the wrong bundle — no error, agent thinks it worked.

Don't try to match by querying Metro's HTTP manifest endpoint.
Recent Expo versions return the manifest as `multipart/mixed`
(not plain JSON), and the needed headers vary by SDK version —
grep-matching the response is fragile. **The reliable answer
comes from `lsof`**: ask the OS which PID owns each port, then ask
the OS what that PID's working directory is. If it matches `pwd`,
that's our Metro. Doesn't depend on any of Metro's HTTP endpoints.

```bash
# What directory is "this project"?
CURRENT_DIR=$(pwd -P)

# Scan likely Metro ports. For each, find the listener's PID, then
# that PID's cwd. Match = our Metro.
PORT=""
for p in 8081 8082 8083 8084 8085 8086 8087 8088; do
  PID=$(lsof -tiTCP:$p -sTCP:LISTEN 2>/dev/null | head -n1)
  [ -z "$PID" ] && continue

  # `-Fn` with `-a -d cwd` prints a machine-readable record; the
  # `n`-prefixed line is the cwd path. Works on macOS BSD lsof.
  CWD=$(lsof -p "$PID" -a -d cwd -Fn 2>/dev/null | awk '/^n/{print substr($0,2); exit}')
  # Resolve any symlinks so comparison is canonical.
  CWD_REAL=$(cd "$CWD" 2>/dev/null && pwd -P)

  if [ -n "$CWD_REAL" ] && [ "$CWD_REAL" = "$CURRENT_DIR" ]; then
    PORT=$p
    echo "metro for this project (pid=$PID) on port $PORT"
    break
  fi
done
```

**If `$PORT` is set, skip straight to the deep-link step below.**
Do **not** run `expo start` — Komand's terminal pane is already
running it for this project.

**If `$PORT` is still empty** — either no Metro is running, the
one Komand started hasn't opened its port yet, or every running
Metro belongs to a different project (rare on a typical dev
machine, common if the user scaffolded multiple projects today).
Options, in order of preference:

1. **Wait 3–5 s and retry the scan.** Komand's terminal pane may
   still be mid-startup (CocoaPods initial download can push
   Metro's ready moment to 30–60s on first run of the session).
2. **Check the Komand terminal pane** — if you see
   `› Metro waiting on exp://…:PORT` there, read the port from
   that line and use it directly. That's Komand's own Metro.
3. **Only as a last resort, spawn a new Metro yourself:**

    ```bash
    # Pick a free port
    PORT=8081
    for p in 8081 8082 8083 8084 8085 8086 8087 8088; do
      if ! lsof -iTCP:$p -sTCP:LISTEN >/dev/null 2>&1; then
        PORT=$p
        break
      fi
    done

    # Use the Bash tool's `run_in_background: true` flag — `&` in
    # a non-TTY shell makes `expo start` silently bail on any
    # prompt.
    npx expo start --dev-client --port $PORT
    ```

    After spawning, give Metro 2–3 s to come up before deep-linking.
    The new Metro's cwd will be the current project (because you
    `cd`'d here), so re-running the detection loop will find it.

**Deep-link the dev client to Metro** (one shell call, replace
`<slug>` with `expo.slug` from `app.json`):

```bash
xcrun simctl openurl <UDID> "exp+<slug>://expo-development-client/?url=http://127.0.0.1:$PORT"
```

The dev client receives the URL, connects to Metro, loads the
project. If the preview instead stays on the dev-client launcher
screen (the "Development servers" list with multiple localhost
URLs), it means either the deep link didn't fire, or Metro isn't
actually listening on `$PORT` — re-run the detection loop above.

**If the dev client opens but displays a DIFFERENT project's UI**
(wrong tabs, wrong colors, "welcome to <other-app>"), the deep
link pointed at a Metro serving another project. This happens when
the detection loop above is run without slug-matching — the agent
grabbed the first port responding with `packager-status:running`
without verifying which project that Metro belongs to. Re-run
detection with the slug filter from step 6.

**If you see multiple Metro ports in the dev client's "Development
servers" list**, you (or a prior attempt) spawned duplicates. Kill
the extras (`lsof -ti:808X | xargs kill`) keeping only the one
whose manifest slug matches this project, and re-fire the deep link.

### 7) Edit-save-see loop (automatic after setup)

Once the dev client is connected to Metro, the user's normal loop is
fully hands-free:

1. Edit `.ts` / `.tsx` / `.js` / `.jsx`
2. Save
3. Metro rebuilds (fast — incremental, typically <300 ms)
4. The sim auto-refreshes in Komand's preview
5. React Fast Refresh preserves component state across the reload

You do **not** need to re-run `build_sim`, `install_app_sim`, or
`launch_app_sim` for JS changes. Those only run again when:

- Native code changed (new config plugin, new native module, a
  version bump of `expo-dev-client`, any edit under `ios/`)
- `package.json` added a package with autolinked native code
- The user wants a cold boot for some reason

If edits stop reflecting, the cause is almost always one of:

- **Dev client never connected to Metro in the first place** — the
  app is sitting on the "Development servers" launcher screen in
  the sim. The deep link didn't fire or pointed at a dead port.
  Re-run step 6's detection and `simctl openurl`.
- **You spawned a duplicate Metro** — the dev client's launcher
  shows multiple localhost URLs. Kill all Metros except Komand's
  auto-started one (`lsof -ti:808X | xargs kill`), re-deep-link.
- Metro bailed silently on port conflict (`expo start … &` in a
  non-TTY shell) — confirm with
  `curl -s http://127.0.0.1:$PORT/status`; if empty, no Metro is
  on that port.
- Dev client is connected to the WRONG project's Metro — the
  scheme enforces which app opens the link, not which project
  Metro serves. Kill the other Metro or re-deep-link at the right
  port.
- Dev client lost WebSocket connection to Metro (shake-to-reload
  or re-fire `simctl openurl ...` to reconnect).
- The app was actually built as a standalone (missing
  `expo-dev-client` — see step 1).

For release builds you've embedded the JS bundle at build time — no
Metro, no hot reload. Only dev client builds participate in this loop.

## Choosing a workflow

The Expo team frames dev clients (not Expo Go) as the default for
anything beyond "learn / experiment". If the project has any custom
native code, config plugins, or third-party native modules, use a dev
client. Expo Go is a quick-try sandbox.

Two workable paths inside Komand:

1. **Dev Client via local prebuild + `build_sim`** (default) — the
   fast local-only loop. No EAS, no cloud, just Xcode + Expo CLI.
   This is what **Core workflow** above already describes.
2. **Expo Go** — zero native build. Only useful for projects that
   work in the Expo Go sandbox (no custom native code).

In both paths, iOS simulators have **no camera**, so the QR codes
printed by `expo start` are useless here. The real mechanism is
`xcrun simctl openurl <UDID> <exp-url>` — LaunchServices routes the
URL to Expo Go or the dev client by scheme. `expo start --ios`
shells the same call internally; we do it manually because
`expo start --ios` also pops Simulator.app.

### URL schemes (one per app type)

- **Expo Go:** `exp://<metro-host>:<port>` — usually
  `exp://127.0.0.1:8081` for localhost Metro.
- **Dev Client:** `exp+<slug>://expo-development-client/?url=http://<metro-host>:<port>`
  where `<slug>` is `expo.slug` from `app.json`. Example:
  `exp+myapp://expo-development-client/?url=http://127.0.0.1:8081`

Tip: set `launchMode: "most-recent"` on the `expo-dev-client` config
plugin in `app.json` so subsequent cold launches auto-open the most
recent project without the launcher UI:

```json
{
    "expo": {
        "plugins": [["expo-dev-client", { "launchMode": "most-recent" }]]
    }
}
```

> **Moving to cloud builds later?** `eas build:dev --platform ios
--profile development --local --skip-bundler` produces the same
> simulator `.app`, which you can feed into `install_app_sim` the
> same way. The `--skip-bundler` flag is required so EAS doesn't
> auto-open Simulator.app. Stick with Core workflow until you need
> EAS's build caching or fingerprint reuse (`eas build:download`).

## Path 1 — Dev Client via local `prebuild` + `build_sim`

When EAS isn't desired (offline, CI constraints, avoiding cloud
auth), build the dev client from the checked-in or generated
`ios/` folder directly. The flow is identical to the core build
workflow in the [Core workflow](#core-workflow) section above —
nothing Expo-specific beyond `expo prebuild -p ios`. After
`launch_app_sim` fires the preview, connect Metro via the
`simctl openurl exp+<slug>://...` deep link described in Core
workflow step 6.

## Path 2 — Expo Go (sandbox only)

Only viable if the project uses zero custom native code and every
dependency is Expo-Go-compatible. Upstream Expo increasingly
discourages this path for anything real; it's a 60-second smoke
test, not a development workflow.

1. Install Expo Go in the sim (once per SDK version per machine).
   Easiest path:

    ```bash
    npx expo start --ios  # interactive, but pops Simulator.app once
    # …or manually, if you already have the Expo Go .app cached:
    xcrun simctl install <UDID> "$HOME/.expo/ios-simulator-app-cache/Exponent-<sdk>.app"
    ```

    The Simulator.app pop is one-time; close it after install.

2. Launch Expo Go via MCP (fires preview hook):

    ```
    mcp__XcodeBuildMCP__launch_app_sim:
      simulatorId: <UDID>
      bundleId:    "host.exp.Exponent"
    ```

3. Start Metro in the background:

    ```bash
    npx expo start
    ```

4. Deep-link Metro into Expo Go:

    ```bash
    xcrun simctl openurl <UDID> "exp://127.0.0.1:8081"
    ```

    Expo Go receives the URL, loads the project.

If Metro is serving over LAN rather than localhost, substitute the
LAN IP — read it from the `expo start` output (`Metro waiting on
exp://…`).

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

Metro / JS console logs live in the `expo start` terminal — that's
separate from iOS system logs captured via MCP.

## Troubleshooting

- **Komand preview doesn't show** → verify you actually called
  `install_app_sim` or `launch_app_sim` and that it returned success.
  The auto-trigger only fires on successful launch/install. Check
  Komand's Tauri dev log for `[MCP hook] komand_ios_preview_trigger`.
- **Build fails with "No such module 'Expo...'"** → run
  `npx expo prebuild -p ios --clean` and then `pod install` inside
  `ios/`. Most MCP workflows run `pod install` as part of `build_sim`;
  if not, do it manually.
- **Build fails and you're tempted to `expo run:ios`** → don't. That
  opens Simulator.app and skips the Komand preview hook. Fix the
  compile error and retry `build_sim`.
- **App launches but shows "Could not connect to development server"**
  → Metro isn't running or isn't reachable. Start `expo start` in the
  background and relaunch the app via `launch_app_sim`.
- **Stream black after launch** → transient sidecar warmup. Wait
  ~20 s. If still black, Stop+Start in Komand's iOS tab toolbar.

## Notes on the Komand integration

Komand registers an auto-hook on `install_app_sim` / `launch_app_sim`
that writes its preview-trigger file server-side. That's why no
explicit trigger step appears in the workflow above. The hook lives
in `server/mcp/hooks.js` (`komand_ios_preview_trigger`) and is wired
in this plugin's `.mcp.json` under `postHooks`.

Full preview architecture lives in `docs/ios-sim.md` in the Komand
repo — read it if you need to understand the H.264 streaming,
IndigoHID touch path, or preview trigger cascade.
