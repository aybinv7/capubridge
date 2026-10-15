<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import {
  Bot,
  Copy,
  Check,
  Eye,
  EyeOff,
  RefreshCw,
  ShieldCheck,
  Radio,
  AlertCircle,
  Plus,
  Trash2,
} from "lucide-vue-next";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useMcpStore } from "@/stores/mcp.store";
import { MCP_TOOLS } from "@/types/mcp.types";
import type { McpCapability } from "@/types/mcp.types";
import SettingsSection from "./components/SettingsSection.vue";
import SettingsRow from "./components/SettingsRow.vue";

const mcp = useMcpStore();

const showToken = ref(false);
const portInput = ref("");
const copied = ref<string | null>(null);
const principalName = ref("");
const principalCapabilities = ref<McpCapability[]>(["read"]);
const issuedToken = ref("");
const principalBusy = ref(false);

const capabilityOptions: readonly { id: McpCapability; label: string }[] = [
  { id: "read", label: "Read" },
  { id: "execute", label: "Execute" },
  { id: "authorize", label: "Authorize" },
  { id: "administer", label: "Administer" },
];

onMounted(() => {
  void mcp.refresh();
});

// Keep the editable port field in sync with the store value.
watch(
  () => mcp.port,
  (value) => {
    portInput.value = String(value);
  },
  { immediate: true },
);

const maskedToken = computed(() =>
  issuedToken.value
    ? showToken.value
      ? issuedToken.value
      : "•".repeat(Math.min(issuedToken.value.length, 32))
    : "",
);

const portChanged = computed(() => {
  const parsed = Number(portInput.value);
  return Number.isInteger(parsed) && parsed !== mcp.port;
});

const portValid = computed(() => {
  const parsed = Number(portInput.value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 65535;
});

const clientConfig = computed(() => {
  const url = mcp.url ?? `http://127.0.0.1:${mcp.port}/mcp`;
  const token = issuedToken.value || "<create a principal token>";
  return JSON.stringify(
    {
      mcpServers: {
        capubridge: {
          type: "http",
          url,
          headers: { Authorization: `Bearer ${token}` },
        },
      },
    },
    null,
    2,
  );
});

async function copy(text: string, key: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    copied.value = key;
    window.setTimeout(() => {
      if (copied.value === key) copied.value = null;
    }, 1500);
    toast.success(`${label} copied`);
  } catch (err) {
    toast.error("Copy failed", { description: String(err) });
  }
}

function toggleCapability(capability: McpCapability) {
  principalCapabilities.value = principalCapabilities.value.includes(capability)
    ? principalCapabilities.value.filter((value) => value !== capability)
    : [...principalCapabilities.value, capability];
}

function formatPrincipalTime(value: number | null) {
  return value ? new Date(value).toLocaleString() : "Never";
}

async function createPrincipal() {
  if (!principalName.value.trim()) {
    toast.error("Give this client a name");
    return;
  }
  if (principalCapabilities.value.length === 0) {
    toast.error("Select at least one capability");
    return;
  }
  principalBusy.value = true;
  try {
    const created = await mcp.createPrincipal(
      principalName.value.trim(),
      principalCapabilities.value,
    );
    issuedToken.value = created.token;
    principalName.value = "";
    toast.success("Principal created", { description: "Copy its token now; it is shown once." });
  } catch (err) {
    toast.error("Failed to create principal", { description: String(err) });
  } finally {
    principalBusy.value = false;
  }
}

async function revokePrincipal(id: string) {
  principalBusy.value = true;
  try {
    await mcp.revokePrincipal(id);
    toast.success("Principal revoked");
  } catch (err) {
    toast.error("Failed to revoke principal", { description: String(err) });
  } finally {
    principalBusy.value = false;
  }
}

async function onToggle(value: boolean) {
  try {
    await mcp.setEnabled(value);
    if (mcp.lastIssuedToken) issuedToken.value = mcp.lastIssuedToken;
    toast.success(value ? "MCP access enabled" : "MCP access disabled");
  } catch {
    toast.error("Failed to update MCP access", { description: mcp.error ?? undefined });
  }
}

async function applyPort() {
  if (!portValid.value) {
    toast.error("Port must be between 1 and 65535");
    return;
  }
  try {
    await mcp.setPort(Number(portInput.value));
    toast.success("Port updated");
  } catch {
    toast.error("Failed to set port", { description: mcp.error ?? undefined });
  }
}

async function regenerate() {
  try {
    await mcp.regenerateToken();
    if (mcp.lastIssuedToken) issuedToken.value = mcp.lastIssuedToken;
    toast.success("Token regenerated", {
      description: "Update your MCP client config with the new token.",
    });
  } catch {
    toast.error("Failed to regenerate token", { description: mcp.error ?? undefined });
  }
}

async function onMutationToggle(value: boolean) {
  try {
    await mcp.setAllowMutations(value);
    toast.success(value ? "Mutation access enabled" : "Mutation access disabled");
  } catch {
    toast.error("Failed to update mutation access", { description: mcp.error ?? undefined });
  }
}
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-8 p-6">
    <SettingsSection
      title="AI access (MCP)"
      description="Expose CapuBridge to AI assistants through a local Model Context Protocol server. Off by default; localhost only and token-protected."
    >
      <SettingsRow label="Enable MCP server" description="Let an MCP client connect to CapuBridge">
        <div class="flex items-center gap-3">
          <Badge v-if="mcp.running" variant="outline" class="gap-1 text-[var(--accent)]">
            <Radio :size="12" />
            Running
          </Badge>
          <Badge v-else variant="outline" class="gap-1 text-[var(--fg-muted)]">Stopped</Badge>
          <Switch :model-value="mcp.enabled" :disabled="mcp.busy" @update:model-value="onToggle" />
        </div>
      </SettingsRow>
    </SettingsSection>

    <!-- Error banner -->
    <div
      v-if="mcp.error"
      class="flex items-start gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface-raised)] p-4 text-sm"
    >
      <AlertCircle :size="16" class="mt-0.5 shrink-0 text-destructive" />
      <div>
        <div class="font-medium text-[var(--fg-default)]">Something went wrong</div>
        <p class="mt-0.5 break-words text-xs text-[var(--fg-muted)]">{{ mcp.error }}</p>
      </div>
    </div>

    <!-- Connection details -->
    <SettingsSection
      v-if="mcp.enabled"
      title="Connection"
      description="Paste these into your MCP client (Claude Code, Claude Desktop, Cursor, …)."
    >
      <SettingsRow label="Endpoint URL" description="The Streamable HTTP endpoint">
        <div class="flex items-center gap-2">
          <code class="rounded bg-[var(--bg-surface)] px-2 py-1 text-xs text-[var(--fg-default)]">
            {{ mcp.url ?? `http://127.0.0.1:${mcp.port}/mcp` }}
          </code>
          <Button
            variant="outline"
            size="sm"
            @click="copy(mcp.url ?? `http://127.0.0.1:${mcp.port}/mcp`, 'url', 'URL')"
          >
            <component :is="copied === 'url' ? Check : Copy" :size="14" />
          </Button>
        </div>
      </SettingsRow>

      <SettingsRow label="Bearer token" description="Required in the Authorization header">
        <div class="flex items-center gap-2">
          <code
            class="max-w-[280px] truncate rounded bg-[var(--bg-surface)] px-2 py-1 text-xs text-[var(--fg-default)]"
          >
            {{ maskedToken || "—" }}
          </code>
          <Button
            variant="outline"
            size="sm"
            :disabled="!issuedToken"
            @click="showToken = !showToken"
          >
            <component :is="showToken ? EyeOff : Eye" :size="14" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            :disabled="!issuedToken"
            @click="copy(issuedToken, 'token', 'Token')"
          >
            <component :is="copied === 'token' ? Check : Copy" :size="14" />
          </Button>
          <Button variant="outline" size="sm" :disabled="mcp.busy" @click="regenerate">
            <RefreshCw :size="14" />
            Regenerate
          </Button>
        </div>
      </SettingsRow>

      <SettingsRow label="Port" description="Localhost port the server binds (default 8765)">
        <div class="flex items-center gap-2">
          <Input v-model="portInput" class="h-8 w-24 text-xs" inputmode="numeric" />
          <Button
            variant="outline"
            size="sm"
            :disabled="mcp.busy || !portChanged || !portValid"
            @click="applyPort"
          >
            Apply
          </Button>
        </div>
      </SettingsRow>
      <SettingsRow
        label="Legacy shared principal"
        description="Compatibility toggle for the migrated shared token; new principals use individually selected scopes"
      >
        <Switch
          :model-value="mcp.allowMutations"
          :disabled="mcp.busy"
          @update:model-value="onMutationToggle"
        />
      </SettingsRow>
    </SettingsSection>

    <SettingsSection
      v-if="mcp.enabled"
      title="Client identities"
      description="Each assistant gets its own revocable token and capability scope. Tokens are shown only when created or rotated."
    >
      <div class="space-y-3 p-4">
        <div class="flex flex-wrap items-center gap-2">
          <Input
            v-model="principalName"
            class="h-8 min-w-52 flex-1 text-xs"
            placeholder="Client name, e.g. Claude Desktop"
          />
          <Button size="sm" :disabled="principalBusy" @click="createPrincipal">
            <Plus :size="14" />
            Create principal
          </Button>
        </div>
        <div class="flex flex-wrap gap-2">
          <Button
            v-for="capability in capabilityOptions"
            :key="capability.id"
            size="sm"
            :variant="principalCapabilities.includes(capability.id) ? 'default' : 'outline'"
            :disabled="principalBusy"
            @click="toggleCapability(capability.id)"
          >
            {{ capability.label }}
          </Button>
        </div>
        <div
          v-if="issuedToken"
          class="space-y-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-3"
        >
          <div class="text-xs font-medium text-[var(--fg-default)]">New token — copy it now</div>
          <div class="flex items-center gap-2">
            <code class="min-w-0 flex-1 truncate text-xs text-[var(--fg-muted)]">{{
              issuedToken
            }}</code>
            <Button variant="outline" size="sm" @click="copy(issuedToken, 'issued-token', 'Token')">
              <component :is="copied === 'issued-token' ? Check : Copy" :size="14" />
            </Button>
          </div>
        </div>
        <div v-if="mcp.principals.length === 0" class="text-xs text-[var(--fg-muted)]">
          No client principals yet.
        </div>
        <div
          v-for="principal in mcp.principals"
          :key="principal.id"
          class="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--border-default)] p-3"
        >
          <div class="min-w-48 flex-1">
            <div class="text-sm font-medium text-[var(--fg-default)]">{{ principal.name }}</div>
            <div class="text-xs text-[var(--fg-muted)]">
              {{ principal.id }} · last used {{ formatPrincipalTime(principal.lastUsedAt) }}
            </div>
          </div>
          <div class="flex flex-wrap gap-1">
            <Badge v-for="capability in principal.capabilities" :key="capability" variant="outline">
              {{ capability }}
            </Badge>
            <Badge v-if="principal.revokedAt" variant="destructive">revoked</Badge>
            <Badge v-else variant="outline">…{{ principal.tokenHint }}</Badge>
          </div>
          <Button
            v-if="!principal.revokedAt"
            variant="ghost"
            size="sm"
            :disabled="principalBusy"
            @click="revokePrincipal(principal.id)"
          >
            <Trash2 :size="14" />
            Revoke
          </Button>
        </div>
      </div>
    </SettingsSection>

    <!-- Client config snippet -->
    <SettingsSection
      v-if="mcp.enabled"
      title="Client config"
      description="Ready-to-paste MCP server entry."
    >
      <div class="space-y-3 p-4">
        <pre
          class="max-h-64 overflow-auto rounded-lg bg-[var(--bg-surface)] p-3 text-xs text-[var(--fg-default)]"
        ><code>{{ clientConfig }}</code></pre>
        <Button variant="outline" size="sm" @click="copy(clientConfig, 'config', 'Config')">
          <component :is="copied === 'config' ? Check : Copy" :size="14" />
          Copy config
        </Button>
      </div>
    </SettingsSection>

    <!-- Tools -->
    <SettingsSection
      title="Available tools"
      :description="`${MCP_TOOLS.length} tools exposed to connected clients.`"
    >
      <SettingsRow
        v-for="tool in MCP_TOOLS"
        :key="tool.name"
        :label="tool.name"
        :description="tool.description"
      >
        <Badge v-if="tool.readOnly" variant="outline" class="text-[var(--fg-muted)]">
          read-only
        </Badge>
        <Badge v-else variant="outline" class="text-[var(--accent)]">mutating</Badge>
      </SettingsRow>
    </SettingsSection>

    <!-- Security note -->
    <div
      class="flex items-start gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface-raised)] p-4 text-sm text-[var(--fg-muted)]"
    >
      <ShieldCheck :size="16" class="mt-0.5 shrink-0 text-[var(--accent)]" />
      <div class="space-y-1">
        <div class="font-medium text-[var(--fg-default)]">Security</div>
        <p class="text-xs">
          The server binds to <code>127.0.0.1</code> only and rejects non-loopback hosts. Every
          request must carry a named principal token. Each principal has its own scopes and can be
          revoked without affecting other clients. Tokens are shown only at creation or rotation;
          keep them private.
        </p>
      </div>
    </div>

    <div class="flex items-center gap-2 text-xs text-[var(--fg-muted)]">
      <Bot :size="14" />
      Learn more about the Model Context Protocol at modelcontextprotocol.io
    </div>
  </div>
</template>
