/** Default localhost port for the MCP endpoint (matches the Rust `DEFAULT_PORT`). */
export const DEFAULT_MCP_PORT = 8765;

/** The MCP tools exposed to clients, for display in the Settings panel. */
export interface McpToolInfo {
  name: string;
  description: string;
  /** Read-only tools are safe to call freely; others may change state. */
  readOnly: boolean;
}

/** Tool surface exposed by the embedded server (kept in sync with the Rust `#[tool]` definitions). */
export const MCP_TOOLS: readonly McpToolInfo[] = [
  {
    name: "get_active_session",
    description: "The active device, tracker status, and all known devices.",
    readOnly: true,
  },
  {
    name: "list_devices",
    description: "Every tracked ADB device with connection status.",
    readOnly: true,
  },
  {
    name: "list_targets",
    description: "Debuggable WebView / CDP targets for a device.",
    readOnly: true,
  },
  {
    name: "select_device",
    description: "Set or clear the active device.",
    readOnly: false,
  },
  {
    name: "evaluate_js",
    description: "Run JavaScript in a connected WebView target via CDP. Requires confirm: true.",
    readOnly: false,
  },
  {
    name: "read_storage",
    description: "Read localStorage, sessionStorage, or IndexedDB from a target.",
    readOnly: true,
  },
  {
    name: "read_console",
    description: "Read captured console messages for a target (starts capturing on first call).",
    readOnly: true,
  },
  {
    name: "read_network",
    description: "Read captured network requests for a target (starts capturing on first call).",
    readOnly: true,
  },
  {
    name: "list_packages",
    description: "List installed packages on a device.",
    readOnly: true,
  },
  {
    name: "launch_app",
    description: "Launch an app by package name. Requires confirm: true.",
    readOnly: false,
  },
  {
    name: "take_screenshot",
    description: "Capture a screenshot of the device screen (base64 PNG).",
    readOnly: true,
  },
  {
    name: "get_screen_size",
    description: "Get the device's screen size in pixels.",
    readOnly: true,
  },
  {
    name: "tap",
    description: "Tap the screen at (x, y). Requires confirm: true.",
    readOnly: false,
  },
  {
    name: "swipe",
    description: "Swipe the screen between two points. Requires confirm: true.",
    readOnly: false,
  },
  {
    name: "input_text",
    description: "Type text into the focused field. Requires confirm: true.",
    readOnly: false,
  },
  {
    name: "press_key",
    description: "Send an Android key event (HOME, BACK, ENTER, ...). Requires confirm: true.",
    readOnly: false,
  },
  {
    name: "shell_command",
    description: "Run an arbitrary adb shell command. High risk. Requires confirm: true.",
    readOnly: false,
  },
] as const;

/** Status of the embedded MCP server, mirrored from the Rust `McpStatus`. */
export interface McpStatus {
  /** Persisted preference: whether MCP access is turned on. */
  enabled: boolean;
  /** Whether the server is actually bound right now. */
  running: boolean;
  /** Configured localhost port. */
  port: number;
  /** Full endpoint URL, present only while running. */
  url: string | null;
  /** Bearer token (empty until access is first enabled). */
  token: string;
  /** Whether a token has been generated. */
  hasToken: boolean;
}
