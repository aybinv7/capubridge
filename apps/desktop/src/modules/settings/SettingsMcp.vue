<script setup lang="ts">
import { onMounted } from "vue";
import SettingsPage from "./components/SettingsPage.vue";
import McpClientsCard from "./mcp/McpClientsCard.vue";
import McpConfigCard from "./mcp/McpConfigCard.vue";
import McpConnectionCard from "./mcp/McpConnectionCard.vue";
import McpServerCard from "./mcp/McpServerCard.vue";
import McpToolsCard from "./mcp/McpToolsCard.vue";
import { useMcpSettings } from "./mcp/useMcpSettings";

const settings = useMcpSettings();
const { mcp } = settings;

onMounted(() => {
  void mcp.refresh();
});
</script>

<template>
  <SettingsPage
    title="AI access"
    description="Let AI assistants read and drive Capubridge through the Model Context Protocol."
  >
    <McpServerCard
      :enabled="mcp.enabled"
      :running="mcp.running"
      :busy="mcp.busy"
      :error="mcp.error"
      @toggle="settings.setEnabled"
    />

    <template v-if="mcp.enabled">
      <McpConnectionCard
        :endpoint-url="settings.endpointUrl.value"
        :token="settings.issuedToken.value"
        :port="mcp.port"
        :allow-mutations="mcp.allowMutations"
        :busy="mcp.busy"
        @regenerate="settings.regenerateToken"
        @apply-port="settings.setPort"
        @allow-mutations="settings.setAllowMutations"
      />
      <McpClientsCard
        :clients="mcp.principals"
        :issued-token="settings.issuedToken.value"
        :creating="settings.creating.value"
        :revoking-id="settings.revokingId.value"
        :create="settings.createClient"
        @revoke="settings.revokeClient($event.id, $event.name)"
      />
      <McpConfigCard :config="settings.clientConfig.value" />
    </template>

    <McpToolsCard />

    <p class="px-1 text-2xs text-[var(--fg-subtle)]">
      More about the protocol at modelcontextprotocol.io.
    </p>
  </SettingsPage>
</template>
