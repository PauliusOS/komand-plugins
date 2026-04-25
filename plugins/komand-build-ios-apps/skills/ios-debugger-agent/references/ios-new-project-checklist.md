# iOS new-project scaffolding checklist

If you're creating an iOS app from scratch (not modifying an existing
Xcode project), use this as your baseline. Copy the templates verbatim
and tweak from there — don't reinvent the plumbing. The most common
scaffolding bug is a missing `UILaunchScreen`, which causes iOS to
render the app in "compatibility mode" — a smaller, letterboxed window
centered on the screen. The checklist prevents that and a few related
issues.

## The critical keys

Without these, iOS renders the app at the wrong size, the wrong
orientation, or with broken scene lifecycle:

| Key                                                             | Why it matters                                                                   | Where                     |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------- |
| `CFBundleIdentifier`                                            | `get_app_bundle_id` fails if missing                                             | `Info.plist`              |
| `UILaunchScreen`                                                | **Fixes the "small app" bug** — without it, iOS falls back to compatibility mode | `Info.plist`              |
| `UIApplicationSceneManifest`                                    | SwiftUI App lifecycle needs this                                                 | `Info.plist`              |
| `UISupportedInterfaceOrientations`                              | Prevents a blank-launch on unsupported orientations                              | `Info.plist`              |
| `TARGETED_DEVICE_FAMILY`                                        | `1` for iPhone-only, `1,2` for universal. Wrong value = iPad layout on iPhone    | `.pbxproj` build settings |
| `INFOPLIST_FILE` (if manual) or `GENERATE_INFOPLIST_FILE = YES` | Controls whether Xcode honors your Info.plist or generates one                   | `.pbxproj` build settings |

## Minimal Info.plist template

Copy this verbatim into `<AppName>/Info.plist`. Works for modern
SwiftUI `App` lifecycle, iPhone-only, portrait + landscape:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDevelopmentRegion</key>
    <string>$(DEVELOPMENT_LANGUAGE)</string>
    <key>CFBundleExecutable</key>
    <string>$(EXECUTABLE_NAME)</string>
    <key>CFBundleIdentifier</key>
    <string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>CFBundleName</key>
    <string>$(PRODUCT_NAME)</string>
    <key>CFBundlePackageType</key>
    <string>$(PRODUCT_BUNDLE_PACKAGE_TYPE)</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0</string>
    <key>CFBundleVersion</key>
    <string>1</string>
    <key>LSRequiresIPhoneOS</key>
    <true/>
    <key>UIApplicationSceneManifest</key>
    <dict>
        <key>UIApplicationSupportsMultipleScenes</key>
        <false/>
    </dict>
    <key>UILaunchScreen</key>
    <dict/>
    <key>UIRequiredDeviceCapabilities</key>
    <array>
        <string>arm64</string>
    </array>
    <key>UISupportedInterfaceOrientations</key>
    <array>
        <string>UIInterfaceOrientationPortrait</string>
        <string>UIInterfaceOrientationLandscapeLeft</string>
        <string>UIInterfaceOrientationLandscapeRight</string>
    </array>
</dict>
</plist>
```

Key notes:

- **`UILaunchScreen` is an empty dict `<dict/>`.** That's not a
  placeholder — empty is the correct value for "use system default
  launch screen." Populating it with content is optional (tint color,
  image).
- **`$(...)` placeholders** get resolved from `.pbxproj` build
  settings. Keep them — they mean "inherit from the build config."
- **`LSRequiresIPhoneOS = true`** tells the simulator runtime this is
  an iOS app (not a macOS Catalyst app).

## Minimal `.pbxproj` build settings

In both the Debug and Release configurations of the app target:

```
PRODUCT_BUNDLE_IDENTIFIER = com.example.YourApp;
PRODUCT_NAME = "YourApp";
INFOPLIST_FILE = YourApp/Info.plist;
GENERATE_INFOPLIST_FILE = NO;
TARGETED_DEVICE_FAMILY = "1";
IPHONEOS_DEPLOYMENT_TARGET = 17.0;
SWIFT_VERSION = 5.0;
SUPPORTS_MACCATALYST = NO;
SUPPORTS_MAC_DESIGNED_FOR_IPHONE_IPAD = NO;
```

**The most common pitfall**: `GENERATE_INFOPLIST_FILE = YES` (Xcode 13+
default). When that's on, Xcode _generates_ an Info.plist from
`INFOPLIST_KEY_*` build settings and **ignores your physical
`Info.plist`**. Two ways to handle this:

- **Manual Info.plist** (recommended for agents): set
  `GENERATE_INFOPLIST_FILE = NO` + `INFOPLIST_FILE = path/to/Info.plist`
- **Generated**: keep `GENERATE_INFOPLIST_FILE = YES` and set every
  key via `INFOPLIST_KEY_UILaunchScreen_Generation = YES`,
  `INFOPLIST_KEY_UIApplicationSceneManifest_Generation = YES`, etc.
  (brittle; miss one and you get compatibility mode again)

Go with manual.

## Minimal SwiftUI `App.swift`

```swift
import SwiftUI

@main
struct YourAppApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
```

And a placeholder `ContentView.swift`:

```swift
import SwiftUI

struct ContentView: View {
    var body: some View {
        Text("Hello, iPhone!")
    }
}
```

## Post-scaffold sanity check

After the first successful `build_sim`, **verify** the launch config
made it into the built .app before moving on. This catches the "app
renders small" bug before it surfaces in the preview:

```bash
APP_PATH=$(mcp__XcodeBuildMCP__get_sim_app_path ...)   # or from build output
/usr/libexec/PlistBuddy -c "Print :UILaunchScreen" "$APP_PATH/Info.plist"
/usr/libexec/PlistBuddy -c "Print :CFBundleIdentifier" "$APP_PATH/Info.plist"
```

Expected:

- `:UILaunchScreen` prints `Dict {` (or similar) — not "Does Not Exist"
- `:CFBundleIdentifier` prints something like `com.example.YourApp`

If either errors with "Does Not Exist", the Info.plist didn't land —
go back to the template above and verify `GENERATE_INFOPLIST_FILE = NO`

- `INFOPLIST_FILE = ...` in the .pbxproj.

## What this prevents

- ✅ "App renders small, letterboxed, centered" (missing `UILaunchScreen`)
- ✅ "iPad layout on iPhone" (wrong `TARGETED_DEVICE_FAMILY`)
- ✅ `get_app_bundle_id` errors with "CFBundleIdentifier Does Not Exist"
- ✅ SwiftUI `@main App` lifecycle warnings (missing
  `UIApplicationSceneManifest`)
- ✅ Launch crashes on unsupported orientation
