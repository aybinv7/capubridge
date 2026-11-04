<script setup lang="ts">
import { computed, ref } from "vue";
import { ChevronRight } from "lucide-vue-next";
import type { ConsoleCapuEvent, ConsoleArgRecord, ConsolePropRecord } from "@/types/replay.types";
import type { ConsoleArg, ConsoleProp } from "@/types/console.types";
import ConsoleArgsView from "@/components/console/ConsoleArgsView.vue";

const props = defineProps<{
  events: ConsoleCapuEvent[];
  positionMs: number;
}>();

const groupOverride = ref(new Map<string, boolean>());

interface Row {
  key: string;
  ev: ConsoleCapuEvent;
  args: ConsoleArg[];
  isGroup: boolean;
  groupCollapsed: boolean;
  id: string | null;
  parentId: string | null;
}

function recordToArg(r: ConsoleArgRecord): ConsoleArg {
  if (r.kind === "primitive") return { kind: "primitive", text: r.text };
  return {
    kind: "object",
    description: r.description,
    subtype: r.subtype,
    overflow: r.overflow,
    objectId: null,
    properties: r.properties.map(
      (p: ConsolePropRecord): ConsoleProp => ({
        name: p.name,
        value: recordToArg(p.value),
      }),
    ),
  };
}

const enriched = computed<Row[]>(() => {
  return props.events
    .filter((ev) => ev.t <= props.positionMs)
    .sort((a, b) => a.t - b.t)
    .map((ev, i) => {
      const args: ConsoleArg[] =
        ev.data.args && ev.data.args.length > 0
          ? ev.data.args.map(recordToArg)
          : [{ kind: "primitive", text: ev.data.text } as ConsoleArg];
      return {
        key: ev.data.id ?? `idx_${i}_${ev.t}`,
        ev,
        args,
        isGroup: ev.data.isGroup ?? false,
        groupCollapsed: ev.data.groupCollapsed ?? false,
        id: ev.data.id ?? null,
        parentId: ev.data.parentId ?? null,
      };
    });
});

const childrenByParent = computed(() => {
  const map = new Map<string, Row[]>();
  for (const r of enriched.value) {
    if (r.parentId) {
      if (!map.has(r.parentId)) map.set(r.parentId, []);
      map.get(r.parentId)!.push(r);
    }
  }
  return map;
});

function isExpanded(row: Row): boolean {
  if (!row.id) return !row.groupCollapsed;
  const o = groupOverride.value.get(row.id);
  if (o !== undefined) return o;
  return !row.groupCollapsed;
}

function toggleGroup(row: Row) {
  if (!row.id) return;
  const next = new Map(groupOverride.value);
  next.set(row.id, !isExpanded(row));
  groupOverride.value = next;
}

const visibleRows = computed(() => {
  const out: Array<{ row: Row; depth: number }> = [];
  const visited = new Set<string>();
  function visit(r: Row, depth: number) {
    if (visited.has(r.key)) return;
    visited.add(r.key);
    out.push({ row: r, depth });
    if (r.isGroup && r.id && isExpanded(r)) {
      const kids = childrenByParent.value.get(r.id) ?? [];
      for (const k of kids) {
        if (k.id === r.id) continue;
        visit(k, depth + 1);
      }
    }
  }
  for (const r of enriched.value) {
    if (r.parentId) continue;
    visit(r, 0);
  }
  return out;
});

function rowClass(level: string): string {
  if (level === "error") return "bg-error/[0.07] border-l-2 border-error/60 hover:bg-error/[0.12]";
  if (level === "warn" || level === "warning")
    return "bg-warning/[0.07] border-l-2 border-warning/60 hover:bg-warning/[0.12]";
  return "border-l-2 border-transparent hover:bg-surface-2/40";
}

function textClass(level: string): string {
  if (level === "error") return "text-error";
  if (level === "warn" || level === "warning") return "text-warning";
  if (level === "info") return "text-info";
  if (level === "debug") return "text-violet-300";
  return "text-foreground/85";
}

function sourceLabel(ev: ConsoleCapuEvent): string {
  if (!ev.data.source) return "";
  if (ev.data.line != null) return `${ev.data.source}:${ev.data.line}`;
  return ev.data.source;
}
</script>

<template>
  <div class="flex flex-col h-full min-h-0">
    <div class="flex-none px-3 py-1.5 border-b border-border/20 flex items-center gap-2">
      <span class="text-2xs font-medium text-muted-foreground uppercase tracking-wide">
        Console
      </span>
      <span class="text-2xs text-muted-foreground/40">
        {{ enriched.length }} / {{ events.length }}
      </span>
    </div>

    <div class="flex-1 overflow-y-auto min-h-0 font-mono text-2xs">
      <div v-if="visibleRows.length === 0" class="flex items-center justify-center h-16">
        <p class="text-2xs text-muted-foreground/40">No console entries yet</p>
      </div>

      <div
        v-for="{ row, depth } in visibleRows"
        :key="row.key"
        class="group"
        :class="rowClass(row.ev.data.level)"
      >
        <div
          class="flex items-start gap-1 px-2 py-1"
          :style="{ paddingLeft: `${8 + depth * 14}px` }"
          :class="row.isGroup ? 'cursor-pointer' : ''"
          @click="row.isGroup && toggleGroup(row)"
        >
          <ChevronRight
            v-if="row.isGroup"
            class="mt-[2px] h-3 w-3 shrink-0 text-muted-foreground/55 transition-transform"
            :class="isExpanded(row) ? 'rotate-90' : ''"
          />
          <span v-else class="mt-[2px] h-3 w-3 shrink-0" />

          <div class="flex-1 min-w-0">
            <ConsoleArgsView :args="row.args" :text-class="textClass(row.ev.data.level)" />
          </div>

          <span
            v-if="sourceLabel(row.ev)"
            class="ml-2 shrink-0 truncate text-2xs text-muted-foreground/45 max-w-[35%]"
            :title="sourceLabel(row.ev)"
          >
            {{ sourceLabel(row.ev) }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
