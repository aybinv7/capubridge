# Quick Start

Connect your first Android device and explore its storage in 5 minutes.

## Step 1: Open Capubridge

Launch Capubridge from the Start Menu or by running `capubridge.exe`.

The app opens to the **Devices** module by default.

## Step 2: Connect a device

### Via USB

1. Connect your Android device to your PC via USB
2. Enable **USB debugging** on the device (Settings → Developer options → USB debugging)
3. Tap **Allow USB debugging** when the prompt appears on your device
4. Click the **device pill** in the sidebar (shows "No connection")
5. Select your device from the list
6. Click **Connect**

### Via Wi-Fi

1. Connect your device via USB first
2. Open a terminal on your PC and run:

```bash
adb tcpip 5555
```

3. Disconnect the USB cable
4. Find your device's IP address (Settings → About → Status → IP address)
5. In Capubridge, click the device pill → **Pair wirelessly**
6. Enter the IP address and port `5555`

## Step 3: Inspect a target

Once connected, you need to select a **target** — a Chrome tab or WebView running on the device.

1. The **Target Selector** opens automatically when you connect
2. You'll see a list of WebViews (pages from Chrome, other apps)
3. Select one and click **Inspect**

The connection status in the sidebar changes to green.

## Step 4: Explore IndexedDB

Now that you're connected, let's explore the storage on the device.

1. Click **Storage** in the sidebar
2. The **Storage Panel** opens with tabs for each storage type

![Screenshot of the Storage Panel showing IndexedDB, LocalStorage, SQLite, OPFS, Cache API, and Storage Graph tabs](https://s3 screenshot)

### Browse IndexedDB

1. Click the **IndexedDB** tab
2. The explorer shows all IndexedDB databases in the selected target
3. Click a database to expand its object stores
4. Click an object store to browse its records in a **TanStack Table**

The table supports:

- **Sorting** — click column headers
- **Filtering** — use the toolbar search or advanced filters
- **Virtual scrolling** — smooth scrolling through large datasets
- **Column settings** — show/hide columns via the toolbar
- **CRUD operations** — create, read, update, delete records

### Browse LocalStorage

1. Click the **LocalStorage** tab
2. View all key-value pairs in a simple list
3. Click a value to view/edit the JSON

### Browse SQLite

1. Click the **SQLite** tab
2. Select a database from the list
3. Browse tables and their rows in a TanStack Table
4. Run SQL queries via the filter builder

## Step 5: Use the command palette

Press `⌘K` (Windows) to open the **Command Palette**.

From here you can:

- Search any command or action
- Jump to any module
- Open the device manager
- Toggle the dock

## What's next?

<div class="grid grid-cols-2 gap-4 my-8">

[Device Management →](../modules/devices) Learn about logcat, file explorer, and app browser.

[Storage Inspector →](../modules/storage) Deep-dive into IndexedDB, SQLite, OPFS, and more.

[Architecture →](../architecture/) Understand how the session runtime works.

</div>
