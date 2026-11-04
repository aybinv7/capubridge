<script setup lang="ts">
import {
  Bot,
  Braces,
  CheckCircle2,
  CircleDot,
  Cpu,
  Eye,
  ListTree,
  LockKeyhole,
  Send,
  Smartphone,
} from "lucide-vue-next";
import { computed, ref } from "vue";
import { useVirtualizer } from "@tanstack/vue-virtual";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PersistedAutomationTaskSnapshot } from "./taskEvents";
import type { AutomationTaskEvent } from "@/types/automation.types";

const props = defineProps<{
  tasks: PersistedAutomationTaskSnapshot[];
  selectedTaskId: string | null;
  selectedEventId: string | null;
}>();

const emit = defineEmits<{
  selectTask: [taskId: string];
  selectEvent: [taskId: string, eventId: string];
}>();

const collapsed = ref(false);
const scrollRef = ref<HTMLDivElement | null>(null);
const rows = computed(() =>
  props.tasks
    .flatMap((snapshot) => snapshot.events.map((event) => ({ snapshot, event })))
    .sort((left, right) => right.event.occurredAt - left.event.occurredAt),
);
const virtualizer = useVirtualizer(
  computed(() => ({
    count: rows.value.length,
    getScrollElement: () => scrollRef.value,
    estimateSize: () => 68,
    overscan: 6,
  })),
);
const virtualItems = computed(() => virtualizer.value.getVirtualItems());

function eventIcon(event: AutomationTaskEvent) {
  if (event.kind === "reasoning.streamed" || event.kind === "reasoning.decision") return Cpu;
  if (event.kind === "authorization.consumed" || event.kind === "authorization.denied")
    return LockKeyhole;
  if (event.kind === "action.dispatched") return Smartphone;
  if (event.kind === "observation.captured") return Eye;
  if (
    event.kind === "verification.completed" ||
    event.kind === "acceptance.milestone" ||
    event.kind === "acceptance.reported"
  )
    return CheckCircle2;
  if (event.kind === "plan.updated") return ListTree;
  if (event.origin === "mcp") return Braces;
  return Send;
}

function eventLabel(event: AutomationTaskEvent): string {
  if (event.kind === "reasoning.streamed") return `${event.data.provider} response`;
  if (event.kind === "reasoning.decision") return `Decision: ${event.data.operation}`;
  if (event.kind === "authorization.consumed") return `Authorization: ${event.data.actionClass}`;
  if (event.kind === "authorization.denied") return `Authorization denied: ${event.data.reason}`;
  if (event.kind === "action.dispatched") return `Device: ${event.data.operation}`;
  if (event.kind === "verification.completed") return "Verification";
  if (event.kind === "acceptance.milestone") return `Acceptance: ${event.data.milestone}`;
  if (event.kind === "acceptance.reported")
    return `Acceptance report: ${event.data.report.availability}`;
  if (event.kind === "observation.captured") return "Device observation";
  return event.kind.replace(".", " ");
}

function taskLabel(snapshot: PersistedAutomationTaskSnapshot): string {
  return snapshot.task.originalGoal || "Untitled task";
}
</script>

<template>
  <aside
    :class="[
      'flex h-full shrink-0 flex-col border-r border-border/60 bg-card transition-[width] duration-200',
      collapsed ? 'w-12' : 'w-72',
    ]"
  >
    <div class="flex h-12 shrink-0 items-center gap-2 border-b border-border/60 px-3">
      <CircleDot class="size-4 text-primary" />
      <span v-if="!collapsed" class="min-w-0 flex-1 text-sm font-semibold">Task history</span>
      <Button size="icon" variant="ghost" class="size-7" @click="collapsed = !collapsed">
        <Bot class="size-4" />
      </Button>
    </div>
    <div v-if="!collapsed" ref="scrollRef" class="min-h-0 flex-1 overflow-auto p-2">
      <div :style="{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }">
        <section
          v-for="item in virtualItems"
          :key="item.key"
          :style="{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            transform: `translateY(${item.start}px)`,
          }"
          class="pb-2"
        >
          <article v-if="rows[item.index]" class="rounded-lg border border-border/60 p-2">
            <button
              type="button"
              :class="[
                'flex w-full flex-col gap-1 rounded text-left',
                rows[item.index].event.id === selectedEventId ? 'bg-muted p-1' : '',
              ]"
              @click="
                emit('selectEvent', rows[item.index].snapshot.task.id, rows[item.index].event.id)
              "
            >
              <span class="flex items-center gap-2 text-xs font-medium leading-4">
                <component :is="eventIcon(rows[item.index].event)" class="size-3.5 shrink-0" />
                <span class="truncate">{{ eventLabel(rows[item.index].event) }}</span>
              </span>
              <span class="truncate text-2xs text-muted-foreground">{{
                taskLabel(rows[item.index].snapshot)
              }}</span>
              <span class="flex items-center gap-1 text-2xs text-muted-foreground">
                <Badge variant="outline" class="h-5 px-1.5 text-2xs">{{
                  rows[item.index].snapshot.task.origin
                }}</Badge>
                <span class="truncate">{{ rows[item.index].snapshot.task.principal.label }}</span>
              </span>
            </button>
          </article>
        </section>
      </div>
    </div>
  </aside>
</template>
