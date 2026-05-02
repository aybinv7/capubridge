# Capacitor

First-class tooling for Capacitor apps. View and edit the Capacitor configuration, manage plugins, handle permissions, and configure deeplinks.

## Capacitor config

Edit `capacitor.config.ts` directly in the UI:![Screenshot showing the Capacitor config editor]
The editor uses Monaco Editor with TypeScript support. Changes are validated on save.

### Config fields

| Field                  | Description                | Type     |
| ---------------------- | -------------------------- | -------- |
| `appName`              | App display name           | `string` |
| `appId`                | App identifier             | `string` |
| `androidPackageFormat` | Android package format     | `string` |
| `webDir`               | Web build output directory | `string` |
| `server.url`           | Live reload server URL     | `string` |
| `server.iosScheme`     | iOS URL scheme             | `string` |
| `plugins`              | Plugin-specific config     | `object` |

## Plugins

Manage installed Capacitor plugins:![Screenshot showing the plugins list with name, version, and platform columns]
For each plugin you can:

- **View permissions** — list permissions required
- **Configure** — edit plugin-specific settings
- **Enable/disable** — toggle the plugin
- **View source** — open the plugin's Capacitor config

### Core plugins

| Plugin          | Description                       |
| --------------- | --------------------------------- |
| **App**         | App lifecycle and platform info   |
| **Camera**      | Device camera access              |
| **Filesystem**  | File read/write                   |
| **Geolocation** | GPS location                      |
| **Haptics**     | Device vibration                  |
| **Network**     | Connection status                 |
| **Screen**      | Screen orientation and brightness |
| **Share**       | Native share sheet                |
| **Storage**     | Secure key-value storage          |

## Permissions

Manage Capacitor runtime permissions:![Screenshot showing the permissions list with grant, deny, and prompt states]
Each permission shows:

- **Name** — e.g., `CAMERA`, `GEOLOCATION`
- **Status** — granted, denied, or prompt
- **Description** — what the permission provides
  Click a permission to change its status.

## Deeplinks

Configure URL schemes and deep link patterns:![Screenshot showing the deeplinks editor]
| Field | Description |
|-------|-------------|
| **URL scheme** | e.g., `myapp://` |
| **Host** | Hostname (optional) |
| **Path** | URL path pattern (supports `*` wildcards) |
| **Redirect to** | Internal route to open |
Example: `myapp://account/info` — opens the info page in the app.

## Bridge configuration

View the web-to-native bridge configuration:![Screenshot showing the bridge configuration viewer]
Shows:

- **Protocol version** — Capacitor protocol version
- **JS bridge file** — the injected bridge script
- **Native interface** — available native methods
