<script setup lang="ts">
import CopyAction from "@/shared/components/presentation/CopyAction.vue";
import SettingsCard from "../components/SettingsCard.vue";

const props = defineProps<{ config: string }>();
</script>

<template>
  <SettingsCard
    title="Client configuration"
    description="Paste into Claude Code, Claude Desktop, Cursor or any MCP client."
    padded
  >
    <template #aside>
      <CopyAction :value="props.config" label="Copy the configuration" />
    </template>
    <pre
      class="max-h-64 overflow-auto font-mono text-2xs leading-relaxed text-muted-foreground select-text"
    ><code>{{ props.config }}</code></pre>
  </SettingsCard>
</template>
