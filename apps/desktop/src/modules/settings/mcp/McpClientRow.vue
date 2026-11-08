<script setup lang="ts">
import { computed } from "vue";
import { Bot } from "lucide-vue-next";
import { Button, Chip } from "@capubridge/cladd";
import type { McpPrincipalSummary } from "@/types/mcp.types";
import { CAPABILITY_LABEL } from "./mcpCapabilities";

const props = defineProps<{ client: McpPrincipalSummary; revoking: boolean }>();

const emit = defineEmits<{ revoke: [] }>();

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

const lastUsed = computed(() =>
  props.client.lastUsedAt
    ? `Last used ${dateFormat.format(props.client.lastUsedAt)}`
    : "Never used",
);
</script>

<template>
  <div
    class="flex min-h-12 items-center gap-3 px-3.5 py-2"
    :class="props.client.revokedAt ? 'opacity-60' : undefined"
  >
    <Bot :size="14" :stroke-width="1.7" class="shrink-0 text-muted-foreground" />
    <span class="flex min-w-0 flex-1 flex-col gap-0.5">
      <span class="truncate text-xs text-foreground" :title="props.client.id">
        {{ props.client.name }}
      </span>
      <span class="text-2xs text-[var(--fg-subtle)]">
        {{ lastUsed }}
        <template v-if="!props.client.revokedAt">
          · token ends in <span class="font-mono">{{ props.client.tokenHint }}</span>
        </template>
      </span>
    </span>
    <span class="flex shrink-0 flex-wrap justify-end gap-1">
      <Chip v-for="capability in props.client.capabilities" :key="capability" size="sm">
        {{ CAPABILITY_LABEL[capability] }}
      </Chip>
    </span>
    <Chip v-if="props.client.revokedAt" size="sm" color="red">Revoked</Chip>
    <Button
      v-else
      size="xs"
      variant="transparent"
      color="red"
      :outline="false"
      :loading="props.revoking"
      @click="emit('revoke')"
    >
      Revoke
    </Button>
  </div>
</template>
