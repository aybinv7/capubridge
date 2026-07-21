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
