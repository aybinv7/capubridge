import { computed, ref } from "vue";
import { toast } from "@/lib/toast";
import { useMcpStore } from "@/stores/mcp.store";
import type { McpCapability } from "@/types/mcp.types";

/**
 * What the AI access page does with the MCP store, with a toast for every outcome. The token
 * issued by the last create or rotate lives here only, so it disappears with the page.
 */
export function useMcpSettings() {
  const mcp = useMcpStore();

  const issuedToken = ref("");
  const creating = ref(false);
  const revokingId = ref<string | null>(null);

  const endpointUrl = computed(() => mcp.url ?? `http://127.0.0.1:${mcp.port}/mcp`);

  const clientConfig = computed(() =>
    JSON.stringify(
      {
        mcpServers: {
          capubridge: {
            type: "http",
            url: endpointUrl.value,
            headers: {
              Authorization: `Bearer ${issuedToken.value || "<create a client token>"}`,
            },
          },
        },
      },
      null,
      2,
    ),
  );

  function takeIssuedToken() {
    if (mcp.lastIssuedToken) issuedToken.value = mcp.lastIssuedToken;
  }

  async function setEnabled(value: boolean) {
    try {
      await mcp.setEnabled(value);
      takeIssuedToken();
      toast.success(value ? "AI access is on" : "AI access is off");
    } catch {
      toast.error("Could not change AI access", { description: mcp.error ?? undefined });
    }
  }

  async function setPort(port: number): Promise<boolean> {
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      toast.error("The port must be between 1 and 65535");
      return false;
    }
    try {
      await mcp.setPort(port);
      toast.success(`The server now listens on port ${port}`);
      return true;
    } catch {
      toast.error("Could not change the port", { description: mcp.error ?? undefined });
      return false;
    }
  }

  async function regenerateToken() {
    try {
      await mcp.regenerateToken();
      takeIssuedToken();
      toast.success("New shared token", {
        description: "Update your MCP client with it; the old one no longer works.",
      });
    } catch {
      toast.error("Could not make a new token", { description: mcp.error ?? undefined });
    }
  }

  async function setAllowMutations(value: boolean) {
    try {
      await mcp.setAllowMutations(value);
      toast.success(value ? "The shared token can change things" : "The shared token reads only");
    } catch {
      toast.error("Could not change the shared token", { description: mcp.error ?? undefined });
    }
  }

  async function createClient(name: string, capabilities: McpCapability[]): Promise<boolean> {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Give this client a name");
      return false;
    }
    if (capabilities.length === 0) {
      toast.error("Choose at least one permission");
      return false;
    }
    creating.value = true;
    try {
      const created = await mcp.createPrincipal(trimmed, capabilities);
      issuedToken.value = created.token;
      toast.success(`${trimmed} can connect`, {
        description: "Copy its token now; it is shown only once.",
      });
      return true;
    } catch (error) {
      toast.error("Could not add the client", { description: String(error) });
      return false;
    } finally {
      creating.value = false;
    }
  }

  async function revokeClient(id: string, name: string) {
    revokingId.value = id;
    try {
      await mcp.revokePrincipal(id);
      toast.success(`${name} can no longer connect`);
    } catch (error) {
      toast.error(`Could not revoke ${name}`, { description: String(error) });
    } finally {
      revokingId.value = null;
    }
  }

  return {
    mcp,
    issuedToken,
    creating,
    revokingId,
    endpointUrl,
    clientConfig,
    setEnabled,
    setPort,
    regenerateToken,
    setAllowMutations,
    createClient,
    revokeClient,
  };
}
