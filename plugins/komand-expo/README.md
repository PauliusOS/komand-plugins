# Expo (Komand) — `komand-expo`

Komand's bundled build of Expo's official skills plugin (`expo`) with
one additive, iOS-only extension: iOS simulator runs surface inside
Komand's embedded iPhone preview instead of popping Apple's
Simulator.app. Everything else — Android, web, Expo Go, EAS,
deployments, upgrades — is the upstream Expo plugin, untouched.

The plugin id is `komand-expo` (not `expo`) so it can coexist with
Expo's upstream plugin without collision. Install this one from
Komand's Skills tab → Plugins → Available to Install.

## What this plugin changes (iOS-only)

The upstream `expo` plugin instructs agents to run `npx expo run:ios`
or `npx expo start --ios` to launch iOS simulator builds — both tools
shell out to `open -a Simulator`, which pops Apple's Simulator.app in
a separate window outside Komand's preview.

This plugin adds three small, additive pieces:

- A new **`expo-ios-debugger` skill** that routes iOS runs through
  XcodeBuildMCP's `build_sim` → `install_app_sim` → `launch_app_sim`
  flow. Komand's MCP proxy auto-hooks those tools and writes the
  preview-trigger file server-side, so the embedded iPhone preview
  opens and streams automatically.
- A **`.mcp.json`** wiring `xcodebuildmcp` with two Komand-specific
  extensions: `blockTools` (removes `build_run_sim`,
  `build_run_device`, `open_sim`, `boot_sim` from the agent's tool
  list — those are the four XcodeBuildMCP tools that pop
  Simulator.app) and `postHooks` (`launch_app_sim` /
  `install_app_sim` → `komand_ios_preview_trigger`).
- A **short "Running inside Komand" note** added to
  `building-native-ui/SKILL.md`, pointing agents at
  `expo-ios-debugger` for iOS runs when inside Komand. No existing
  guidance was removed.

## What this plugin does NOT change

This is a full-spectrum Expo plugin. The Komand extension is scoped
tightly to the iOS simulator path. Everything else is the upstream
Expo plugin, as the Expo team shipped it:

- **Android** — `expo run:android`, `expo start --android`, Gradle,
  ADB, emulators: unchanged. XcodeBuildMCP is iOS/macOS-only; Android
  workflows never touch it.
- **Web** — `expo start --web`, `expo export -p web`, EAS Hosting:
  unchanged.
- **Expo Go** — `expo start`, QR code / tunnel connect flows:
  unchanged on all platforms. (On iOS, you can additionally launch
  Expo Go inside the sim via `launch_app_sim host.exp.Exponent` to
  get it into Komand's preview — optional, not required.)
- **EAS** — `eas build`, `eas submit`, `eas deploy`, `eas workflow`:
  unchanged. All EAS skills preserved.
- **TestFlight, App Store Connect, Google Play Store** submission
  flows: unchanged.
- **SDK upgrades, expo-av → expo-video/audio migrations,
  React 19, React Compiler, New Architecture**: unchanged.

## What this plugin removes from upstream

- **`codex-expo-run-actions` skill + `/setup-codex-run-actions`
  command**: removed. Both existed to wire Expo into OpenAI Codex
  desktop app's action button bar by writing
  `script/build_and_run.sh` + `.codex/environments/environment.toml`.
  Komand's Mobile App template already auto-starts
  `npx expo start --dev-client` in the chat's terminal pane via the
  template's `serverCommand`, so the Codex-app-specific config files
  would just be litter in the user's repo.

### Cost to non-iOS users

Installing this plugin spawns the `xcodebuildmcp` MCP server at
session start (same as Komand's `build-ios-apps` plugin). That's a
small, fixed overhead: one `npx` fetch on first run, a couple of
seconds of startup, a few MB of RAM — even for sessions that only
touch Android or web. If an Expo project never targets iOS and you
want zero overhead, install upstream `expo` instead.

## Skills included

### App Design

- **building-native-ui** — Build beautiful apps with Expo Router, styling, components, navigation, and animations (updated with Komand preview note)
- **expo-api-routes** — Create API routes in Expo Router with EAS Hosting
- **expo-dev-client** — Build and distribute Expo development clients locally or via TestFlight
- **expo-ios-debugger** _(new)_ — Build, install, launch, and debug the current Expo iOS app inside Komand's embedded iPhone preview via XcodeBuildMCP
- **expo-module** — Author Expo native modules
- **expo-tailwind-setup** — Set up Tailwind CSS v4 in Expo with NativeWind v5
- **expo-ui-jetpack-compose** — Jetpack Compose UI components for Expo
- **expo-ui-swift-ui** — SwiftUI components for Expo
- **native-data-fetching** — Network requests, API calls, caching, and offline support
- **use-dom** — Run web code in a webview on native using DOM components

### Deployment

- **expo-deployment** — Deploy to iOS App Store, Android Play Store, and web hosting
- **expo-cicd-workflows** — EAS workflow YAML files for CI/CD pipelines

### Upgrading

- **upgrading-expo** — Upgrade Expo SDK versions and fix dependency issues

---

## Original upstream description

Official AI agent skills from the Expo team for building, deploying, upgrading, and debugging Expo apps.

## What This Plugin Does

### App Design

- Provides UI guidelines following Apple Human Interface Guidelines
- Covers Expo Router navigation patterns (stacks, tabs, modals, sheets)
- Explains native iOS controls, SF Symbols, animations, and visual effects
- Guides API route creation with EAS Hosting
- Covers data fetching patterns with React Query, offline support, and Expo Router loaders
- Helps set up Tailwind CSS v4 with NativeWind v5
- Explains DOM components for running web code in native apps
- Wires Expo projects into the Codex app Run button and action terminal

### Deployment

- Guides iOS App Store, TestFlight, and Android Play Store submissions
- Covers EAS Build configuration and version management
- Helps write and validate EAS Workflow YAML files for CI/CD
- Covers web deployment with EAS Hosting

### Upgrading

- Walks through the step-by-step Expo SDK upgrade process
- Identifies deprecated packages and their modern replacements
- Handles cache clearing for both managed and bare workflows
- Fixes dependency conflicts after an upgrade

## When to Use

### App Design

- Building new Expo apps from scratch
- Adding navigation, styling, or animations
- Setting up API routes or data fetching
- Integrating web libraries via DOM components
- Configuring Tailwind CSS for React Native
- Adding a Codex app Run button for `expo start`
- Creating optional Codex action buttons for iOS, Android, Web, dev-client, diagnostics, or export

### Deployment

- Submitting apps to App Store Connect or Google Play
- Setting up TestFlight beta testing
- Configuring EAS Build profiles
- Writing CI/CD workflows for automated deployments
- Deploying web apps with EAS Hosting

### Upgrading

- Upgrading to a new Expo SDK version
- Fixing dependency conflicts after an upgrade
- Migrating from deprecated packages (expo-av to expo-audio/expo-video)
- Cleaning up legacy configuration files

## Skills Included

### App Design

- **building-native-ui** — Build beautiful apps with Expo Router, styling, components, navigation, and animations
- **codex-expo-run-actions** — Wire `script/build_and_run.sh` and `.codex/environments/environment.toml` so the Codex app Run button starts Expo
- **expo-api-routes** — Create API routes in Expo Router with EAS Hosting
- **expo-dev-client** — Build and distribute Expo development clients locally or via TestFlight
- **expo-tailwind-setup** — Set up Tailwind CSS v4 in Expo with NativeWind v5
- **expo-ui-jetpack-compose** — Jetpack Compose UI components for Expo
- **expo-ui-swift-ui** — SwiftUI components for Expo
- **native-data-fetching** — Network requests, API calls, caching, and offline support
- **use-dom** — Run web code in a webview on native using DOM components

### Deployment

- **expo-deployment** — Deploy to iOS App Store, Android Play Store, and web hosting
- **expo-cicd-workflows** — EAS workflow YAML files for CI/CD pipelines

### Upgrading

- **upgrading-expo** — Upgrade Expo SDK versions and fix dependency issues

## License

MIT
