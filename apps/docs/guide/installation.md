# Installation

Capubridge is a desktop app. You run it on your development machine, and it connects to Android devices over ADB.

## System requirements

- **OS:** Windows 10/11, macOS, or Linux
- **Android:** API level 21+ (Android 5.0)
- **ADB:** Must be installed on the host machine

## Installing from release

1. Go to the [releases page](https://github.com/aybinv7/capubridge/releases)
2. Select the package for your platform: `.msi` or `.exe` on Windows, `.dmg` on macOS, or `.AppImage` / `.deb` on Linux
3. Install or launch it using your platform's normal package flow

Linux AppImage users on recent Mesa/Wayland systems may need the compatibility command documented in the project README.

## Building from source

You can also build Capubridge from the source code. This requires [Rust](https://rustup.rs/) and Node.js.

### Prerequisites

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Verify installation
rustc --version
cargo --version
```

### Build steps

```bash
# Clone the repository
git clone https://github.com/aybinv7/capubridge.git
cd capubridge

# Install dependencies
vp install

# Run in development mode
vp run tauri

# Build for production
vp run -r build
```

The built executable will be in `apps/desktop/src-tauri/target/release/`.

## ADB setup

Capubridge needs ADB (Android Debug Bridge) to communicate with devices.

### Runtime resolution

At startup Capubridge resolves ADB in this order:

1. `CAPUBRIDGE_ADB_PATH`, when set
2. Bundled Android platform-tools
3. `adb` available on your system PATH

Install Android platform-tools or Android Studio only when none of those sources is available. The Settings page reports this behavior; it does not currently offer a runtime ADB-path or server-port editor.

## Verifying installation

### Check ADB connection

```bash
adb devices -l
```

You should see your device listed:

```
List of devices attached
RF8N1234567890    device  product:galaxy_s23 model:Galaxy_S23 device:s3a transport_id:1
```

### Check app startup

Run Capubridge and look for:

- The app window opens
- The title bar shows "Capubridge"
- Device workspace and available modules appear after startup

### Connect a device

1. Click the **device pill** in the sidebar footer
2. The device manager opens
3. Select your device and click **Connect**

## Next steps

<div class="grid grid-cols-2 gap-4 my-8">

[Quick Start →](./quick-start) Connect a device and explore your first storage.

[Configure ADB →](./config/adb) Set up ADB path, port, and server options.

</div>
