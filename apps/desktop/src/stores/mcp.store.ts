import { ref, computed } from "vue";
import { defineStore } from "pinia";
import { invokeCommand } from "@/runtime/ipc/client";
import { DEFAULT_MCP_PORT } from "@/types/mcp.types";
import type {
  CreatedMcpPrincipal,
  McpCapability,
  McpPrincipalSummary,
  McpStatus,
} from "@/types/mcp.types";

/**
 * Owns the embedded MCP server's state. All mutations go through the typed
 * Tauri commands, which persist config and (re)start the server as needed;
 * every command returns the fresh status so this store stays in sync.
 */
export const useMcpStore = defineStore("mcp", () => {
  const status = ref<McpStatus | null>(null);
  const busy = ref(false);
  const error = ref<string | null>(null);
  const loaded = ref(false);

  const enabled = computed(() => status.value?.enabled ?? false);
  const running = computed(() => status.value?.running ?? false);
  const port = computed(() => status.value?.port ?? DEFAULT_MCP_PORT);
  const url = computed(() => status.value?.url ?? null);
  const hasToken = computed(() => status.value?.hasToken ?? false);
  const allowMutations = computed(() => status.value?.allowMutations ?? false);
  const principals = computed<McpPrincipalSummary[]>(() => status.value?.principals ?? []);
  const lastIssuedToken = computed(() => status.value?.issuedToken ?? "");

  async function run(op: () => Promise<McpStatus>): Promise<void> {
    busy.value = true;
    error.value = null;
    try {
      status.value = await op();
    } catch (err) {
      error.value = String(err);
      throw err;
    } finally {
      loaded.value = true;
      busy.value = false;
    }
  }

  /** Load current status. Safe to call repeatedly. */
  async function refresh(): Promise<void> {
    await run(() => invokeCommand("mcp_get_status"));
  }

  async function setEnabled(value: boolean): Promise<void> {
    await run(() => invokeCommand("mcp_set_enabled", { enabled: value }));
  }

  async function setPort(value: number): Promise<void> {
    await run(() => invokeCommand("mcp_set_port", { port: value }));
  }

  async function regenerateToken(): Promise<void> {
    await run(() => invokeCommand("mcp_regenerate_token"));
  }

  async function setAllowMutations(value: boolean): Promise<void> {
    await run(() => invokeCommand("mcp_set_allow_mutations", { allowMutations: value }));
  }

  async function listPrincipals(): Promise<McpPrincipalSummary[]> {
    const result = await invokeCommand("mcp_list_principals");
    if (status.value) status.value = { ...status.value, principals: result };
    return result;
  }

  async function createPrincipal(
    name: string,
    capabilities: McpCapability[],
  ): Promise<CreatedMcpPrincipal> {
    const created = await invokeCommand("mcp_create_principal", { name, capabilities });
    if (status.value) {
      status.value = {
        ...status.value,
        principals: [...status.value.principals, created.principal],
      };
    }
    return created;
  }

  async function revokePrincipal(id: string): Promise<void> {
    const next = await invokeCommand("mcp_revoke_principal", { id });
    if (status.value) status.value = { ...status.value, principals: next };
  }

  return {
    status,
    busy,
    error,
    loaded,
    enabled,
    running,
    port,
    url,
    hasToken,
    allowMutations,
    principals,
    lastIssuedToken,
    refresh,
    setEnabled,
    setPort,
    regenerateToken,
    setAllowMutations,
    listPrincipals,
    createPrincipal,
    revokePrincipal,
  };
});
