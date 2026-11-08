<script setup lang="ts">
import { CircleAlert, ShieldCheck } from "lucide-vue-next";
import { StatusDot, Switch } from "@capubridge/cladd";
import SettingsCard from "../components/SettingsCard.vue";
import SettingsRow from "../components/SettingsRow.vue";

const props = defineProps<{
  enabled: boolean;
  running: boolean;
  busy: boolean;
  error: string | null;
}>();

const emit = defineEmits<{ toggle: [value: boolean] }>();
</script>

<template>
  <SettingsCard>
    <SettingsRow
      label="Let AI assistants connect"
      description="A local MCP server on this computer only. Every client needs its own token."
    >
      <span class="flex items-center gap-1.5 text-2xs text-muted-foreground">
        <StatusDot :color="props.running ? 'green' : undefined" />
        {{ props.running ? "Running" : "Stopped" }}
      </span>
      <Switch
        :model-value="props.enabled"
        :disabled="props.busy"
        aria-label="Let AI assistants connect"
        @update:model-value="emit('toggle', $event)"
      />
    </SettingsRow>
    <div v-if="props.error" class="flex items-start gap-2 px-3.5 py-2.5" role="alert">
      <CircleAlert :size="14" class="mt-px shrink-0 text-destructive" aria-hidden="true" />
      <p class="min-w-0 text-2xs break-words text-muted-foreground">
        <span class="text-foreground">Something went wrong.</span> {{ props.error }}
      </p>
    </div>
    <div class="flex items-start gap-2 px-3.5 py-2.5">
      <ShieldCheck
        :size="14"
        :stroke-width="1.7"
        class="mt-px shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
      <p class="text-2xs leading-relaxed text-muted-foreground">
        It listens on <code class="font-mono">127.0.0.1</code> only and refuses any other host. Each
        client has its own permissions and can be revoked without touching the others. Tokens are
        shown once, when made or rotated; keep them private.
      </p>
    </div>
  </SettingsCard>
</template>
