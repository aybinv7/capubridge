<script setup lang="ts">
import { Chip } from "@capubridge/cladd";
import { MCP_TOOLS } from "@/types/mcp.types";
import SettingsCard from "../components/SettingsCard.vue";
import SettingsRow from "../components/SettingsRow.vue";

const readOnlyCount = MCP_TOOLS.filter((tool) => tool.readOnly).length;
</script>

<template>
  <SettingsCard
    title="Tools"
    :description="`${MCP_TOOLS.length} tools: ${readOnlyCount} only read, the others change the device or the app.`"
  >
    <SettingsRow
      v-for="tool in MCP_TOOLS"
      :key="tool.name"
      :label="tool.name"
      :description="tool.description"
      mono
    >
      <Chip v-if="tool.readOnly" size="sm">Reads</Chip>
      <Chip v-else size="sm" color="yellow">Changes</Chip>
    </SettingsRow>
  </SettingsCard>
</template>
