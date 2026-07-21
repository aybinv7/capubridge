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
} from "lucide-vue-next";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useMcpStore } from "@/stores/mcp.store";
import { MCP_TOOLS } from "@/types/mcp.types";
import SettingsSection from "./components/SettingsSection.vue";
import SettingsRow from "./components/SettingsRow.vue";

const mcp = useMcpStore();

const showToken = ref(false);
const portInput = ref("");
const copied = ref<string | null>(null);

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
  mcp.token ? (showToken.value ? mcp.token : "•".repeat(Math.min(mcp.token.length, 32))) : "",
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
  return JSON.stringify(
    {
      mcpServers: {
        capubridge: {
          type: "http",
          url,
          headers: { Authorization: `Bearer ${mcp.token || "<token>"}` },
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

async function onToggle(value: boolean) {
  try {
    await mcp.setEnabled(value);
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
    toast.success("Token regenerated", {
      description: "Update your MCP client config with the new token.",
    });
  } catch {
    toast.error("Failed to regenerate token", { description: mcp.error ?? undefined });
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
            :disabled="!mcp.token"
            @click="showToken = !showToken"
          >
            <component :is="showToken ? EyeOff : Eye" :size="14" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            :disabled="!mcp.token"
            @click="copy(mcp.token, 'token', 'Token')"
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
          request must carry the bearer token. Anyone with the token and local access can drive your
          connected device — keep it private and regenerate it if leaked.
        </p>
      </div>
    </div>

    <div class="flex items-center gap-2 text-xs text-[var(--fg-muted)]">
      <Bot :size="14" />
      Learn more about the Model Context Protocol at modelcontextprotocol.io
    </div>
  </div>
</template>
