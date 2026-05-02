# ADB Settings

Configure how Capubridge connects to Android devices via ADB.

## ADB executable

Capubridge communicates with Android devices through ADB. You can point it to a custom ADB executable or use the bundled version.

### Auto-detect

By default, Capubridge looks for `adb. exe` in your system PATH. If found, it's used automatically.

### Bundled ADB

The app ships a bundled ADB from the Google platform-tools. To use it:

1. Go to **Settings → ADB**
2. Toggle **Use bunded ADB**
3. The app uses the bundled binary instead of system ADB

### Custom path

To use a specific ADB installation:

1. Go to **Settings → ADB**
2. Set **ADB executable path** to your `adb. exe` location

## ADB server

### Port

The ADB server runs on your PC. By default, it listens on port `5037`.
To change the port:

1. Go to **Settings → ADB**
2. Set **ADB server port** to your preferred port
3. Restart the app

### Kill and restart

You can kill and restart the ADB server from the UI:

1. Go to **Settings → ADB**
2. Click **Restart ADB server**
   This is useful when devices show as offline or the connection is stuck.

## Wi-Fi pairing

### Port forwarding

To pair a device over Wi-Fi, the app needs to forward a TCP port:

1. Connect the device via USB first
2. Run `adb tcpip <port>` in a terminal, or use the UI button
3. Disconnect USB
4. Connect over the forwarded port
   The default port for TCP mode is `55` . You can change it in Settings.

## Troubleshooting

### Device not found

- Make sure USB debugging is enabled on the device
- Try **Restart ADB server** in Settings
- Check that no other ADB instance is running (`taskkill /IM adb.exe /F`)

### Offline devices

- Unplug and replug the USB cable
- Revoke USB debugging authorizations on the device (Settings → Developer options → Revoke USB debugging authorizations)
- Accept the debugging prompt again

### Unauthorized device

- Check the device screen — you need to tap **Allow** on the prompt

## Next steps

<div class="grid grid-cols-2 gap-4 my-8">[Quick Start →](../quick-start) Connect a device and explore IndexedDB.</div>
