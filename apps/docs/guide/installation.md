# Installation

Capubridge is a desktop app. You run it on your development machine, and it connects to Android devices over ADB.

## System requirements

- **OS:** Windows 10/11 (primary), macOS (planned), Linux (planned)
- **Android:** API level 21+ (Android 5.0)
- **ADB:** Must be installed on the host machine

## Installing from release

1. Go to the [releases page](https://github.com/aybinv7/capubridge/releases)
2. Download the latest `.exe` installer
3. Run the installer and follow the prompts

The installer will:

- Place the app in `Program Files/Capubridge`
- Create a Start Menu shortcut
- Add `capubridge.exe` to your PATH (optional)

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

### Option 1: Use system ADB

If you already have ADB installed (e.g., from Android Studio or platform-tools):

1. Make sure `adb.exe` is in your PATH
2. Capubridge will auto-detect it

### Option 2: Bundled ADB

Capubridge can bundle its own ADB. In the app:

1. Go to **Settings → ADB**
2. Click **Download bunded ADB**
3. The app downloads platform-tools automatically

### Option 3: Custom path

1. Go to **Settings → ADB**
2. Set **ADB executable path** to your `adb.exe` location
3. Optionally set **ADB server port** (default: `5037`)

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
- The sidebar shows 6 modules: Devices, Storage, Network, Capacitor, Inspect, Settings

### Connect a device

1. Click the **device pill** in the sidebar footer
2. The device manager opens
3. Select your device and click **Connect**

## Next steps

<div class="grid grid-cols-2 gap-4 my-8">

[Quick Start →](./quick-start) Connect a device and explore your first storage.

[Configure ADB →](./config/adb) Set up ADB path, port, and server options.

</div>
