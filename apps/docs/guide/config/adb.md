# ADB Settings

Capubridge resolves and manages its ADB connection automatically.

## ADB executable

Capubridge communicates with Android devices through ADB. It resolves the executable when the app starts.

### Auto-detect

Resolution order is `CAPUBRIDGE_ADB_PATH`, bundled platform-tools, then `adb` on your system PATH.

### Bundled ADB

Release builds bundle Android platform-tools. For a non-default local executable, set `CAPUBRIDGE_ADB_PATH` before launching Capubridge.

## ADB server

### Port

The ADB server runs on your PC and uses its standard port `5037`. Changing the server port is not currently supported in the UI.

### Kill and restart

Restart the server with Android platform-tools when devices are offline or stuck:

```bash
adb kill-server
adb start-server
```

## Wi-Fi pairing

### Port forwarding

To pair a device over Wi-Fi, the app needs to forward a TCP port:

1. Connect the device via USB first
2. Run `adb tcpip <port>` in a terminal, or use the UI button
3. Disconnect USB
4. Connect over the forwarded port
   Choose the port in the command you run; Capubridge does not currently configure it in Settings.

## Troubleshooting

### Device not found

- Make sure USB debugging is enabled on the device
- Restart the ADB server from a terminal
- Check that no other ADB installation is fighting for port `5037`

### Offline devices

- Unplug and replug the USB cable
- Revoke USB debugging authorizations on the device (Settings → Developer options → Revoke USB debugging authorizations)
- Accept the debugging prompt again

### Unauthorized device

- Check the device screen — you need to tap **Allow** on the prompt

## Next steps

<div class="grid grid-cols-2 gap-4 my-8">[Quick Start →](../quick-start) Connect a device and explore IndexedDB.</div>
