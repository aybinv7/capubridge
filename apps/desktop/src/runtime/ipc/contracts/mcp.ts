import type { IpcCommand } from "@/runtime/ipc/contracts/common";
import type { McpStatus } from "@/types/mcp.types";

export interface McpCommandMap {
  mcp_get_status: IpcCommand<undefined, McpStatus>;
  mcp_set_enabled: IpcCommand<{ enabled: boolean }, McpStatus>;
  mcp_set_port: IpcCommand<{ port: number }, McpStatus>;
  mcp_regenerate_token: IpcCommand<undefined, McpStatus>;
  /** Frontend → Rust: complete a pending bridge request (see `useMcpBridge`). */
  mcp_bridge_respond: IpcCommand<
    { requestId: string; ok: boolean; result?: unknown; error?: string | null },
    void
  >;
}
