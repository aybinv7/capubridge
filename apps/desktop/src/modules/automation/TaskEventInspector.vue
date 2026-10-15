<script setup lang="ts">
import { X } from "lucide-vue-next";
import { computed } from "vue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PersistedAutomationTaskSnapshot } from "./taskEvents";
import type { AutomationTaskEvent } from "@/types/automation.types";

const props = defineProps<{
  task: PersistedAutomationTaskSnapshot | null;
  event: AutomationTaskEvent | null;
}>();

const emit = defineEmits<{ close: [] }>();

const envelope = computed(() => {
  if (props.task === null || props.event === null) return null;
  return JSON.stringify(
    {
      event: props.event.kind,
      sequence: props.event.sequence,
      occurredAt: new Date(props.event.occurredAt).toISOString(),
      origin: props.event.origin,
      authenticatedClient: props.task.task.principal.clientName ?? props.task.task.principal.label,
      principalId: props.event.principalId,
      connectionId: props.event.connectionId,
      reasoningOwner: props.task.task.reasoningOwner,
      authorization: props.task.task.authorizationScope?.id ?? "none",
      device: props.task.task.deviceSerial,
      data: props.event.data,
    },
    null,
    2,
  );
});

const model = computed(() =>
  props.event?.kind === "reasoning.streamed" ? props.event.data.modelId : "model undisclosed",
);
</script>

<template>
  <aside
    v-if="task !== null && event !== null"
    class="flex h-full w-80 shrink-0 flex-col border-l border-border/60 bg-card"
  >
    <div class="flex items-start gap-2 border-b border-border/60 px-4 py-3">
      <div class="min-w-0 flex-1">
        <p class="text-sm font-semibold">{{ event.kind }}</p>
        <p class="mt-1 text-xs text-muted-foreground">
          {{ new Date(event.occurredAt).toLocaleString() }}
        </p>
      </div>
      <Button size="icon" variant="ghost" class="size-7" @click="emit('close')"
        ><X class="size-4"
      /></Button>
    </div>
    <div class="min-h-0 flex-1 space-y-4 overflow-auto p-4">
      <div class="flex flex-wrap gap-1.5">
        <Badge variant="outline">{{ task.task.origin }}</Badge>
        <Badge variant="outline">{{ task.task.principal.label }}</Badge>
        <Badge variant="outline">{{ task.task.reasoningOwner ?? "owner undisclosed" }}</Badge>
      </div>
      <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-xs">
        <dt class="text-muted-foreground">Provider</dt>
        <dd>{{ event.kind === "reasoning.streamed" ? event.data.provider : "undisclosed" }}</dd>
        <dt class="text-muted-foreground">Model</dt>
        <dd>{{ model }}</dd>
        <dt class="text-muted-foreground">Client</dt>
        <dd class="break-all">{{ task.task.principal.clientName ?? task.task.principal.label }}</dd>
        <dt class="text-muted-foreground">Device</dt>
        <dd class="break-all">{{ task.task.deviceSerial ?? "unassigned" }}</dd>
        <dt class="text-muted-foreground">Authorization</dt>
        <dd>{{ task.task.authorizationScope?.id ?? "not granted" }}</dd>
      </dl>
      <div>
        <p class="mb-2 text-xs font-medium">Inspectable envelope</p>
        <pre
          class="overflow-x-auto rounded-lg bg-muted p-3 text-[11px] leading-4 text-muted-foreground"
          >{{ envelope }}</pre
        >
      </div>
    </div>
  </aside>
</template>
