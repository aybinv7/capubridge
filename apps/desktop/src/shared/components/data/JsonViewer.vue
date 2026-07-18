<script setup lang="ts">
import { computed, ref, watch, nextTick } from "vue";
import {
  ChevronRight,
  ChevronDown,
  X,
  Search,
  ChevronsDownUp,
  ChevronsUpDown,
} from "lucide-vue-next";

const props = defineProps<{
  value: unknown;
  hideLineNumbers?: boolean;
}>();

const jsonString = computed(() => JSON.stringify(props.value, null, 2));

const lineCount = computed(() => jsonString.value.split("\n").length);

const rawLines = computed(() => {
  const json = jsonString.value;
  return json.split("\n").map((line) => {
    const indent = line.search(/\S/);
    const trimmed = line.trimStart();
    const isCollapsible = trimmed.endsWith("{") || trimmed.endsWith("[");
    return {
      raw: line,
      indent: Math.max(0, indent),
      trimmed,
      isCollapsible,
    };
  });
});

const collapsedIndices = ref<Set<number>>(new Set());

function toggleCollapse(idx: number) {
  const next = new Set(collapsedIndices.value);
  if (next.has(idx)) {
    next.delete(idx);
  } else {
    next.add(idx);
  }
  collapsedIndices.value = next;
}

function isCollapsed(idx: number) {
  return collapsedIndices.value.has(idx);
}

function expandAll() {
  collapsedIndices.value = new Set();
}

function collapseAll() {
  const indices: number[] = [];
  for (let i = 0; i < rawLines.value.length; i++) {
    if (rawLines.value[i]!.isCollapsible) indices.push(i);
  }
  collapsedIndices.value = new Set(indices);
}

const collapsibleIndices = computed(() => {
  const indices: number[] = [];
  for (let i = 0; i < rawLines.value.length; i++) {
    if (rawLines.value[i]!.isCollapsible) indices.push(i);
  }
  return indices;
});

const allCollapsed = computed(() => {
  const indices = collapsibleIndices.value;
  if (indices.length === 0) return false;
  return indices.every((idx) => collapsedIndices.value.has(idx));
});

function toggleAll() {
  if (allCollapsed.value) {
    expandAll();
  } else {
    collapseAll();
  }
}

function getVisibleLines() {
  const result: { line: (typeof rawLines.value)[number]; idx: number }[] = [];
  let skipUntilIndent = -1;

  for (let i = 0; i < rawLines.value.length; i++) {
    const line = rawLines.value[i]!;

    if (skipUntilIndent >= 0) {
      if (line.indent > skipUntilIndent) continue;
      skipUntilIndent = -1;
    }

    if (isCollapsed(i) && line.isCollapsible) {
      skipUntilIndent = line.indent;
      result.push({ line, idx: i });
      continue;
    }

    result.push({ line, idx: i });
  }

  return result;
}

const filterText = ref("");
const filterActive = computed(() => filterText.value.length > 0);

const matchPositions = computed(() => {
  const term = filterText.value.toLowerCase();
  if (!term) return [];
  const positions: { lineIdx: number; start: number; end: number }[] = [];
  for (let i = 0; i < rawLines.value.length; i++) {
    const line = rawLines.value[i]!.raw.toLowerCase();
    let idx = line.indexOf(term);
    while (idx !== -1) {
      positions.push({
        lineIdx: i,
        start: idx,
        end: idx + filterText.value.length,
      });
      idx = line.indexOf(term, idx + 1);
    }
  }
  return positions;
});

const matchLines = computed(() => {
  const seen = new Set<number>();
  for (const m of matchPositions.value) {
    seen.add(m.lineIdx);
  }
  return Array.from(seen);
});

const activeMatchIdx = ref(0);

watch(filterText, () => {
  activeMatchIdx.value = 0;
});

function nextMatch() {
  if (matchPositions.value.length === 0) return;
  activeMatchIdx.value = (activeMatchIdx.value + 1) % matchPositions.value.length;
  scrollToActiveMatch();
}

function prevMatch() {
  if (matchPositions.value.length === 0) return;
  activeMatchIdx.value =
    (activeMatchIdx.value - 1 + matchPositions.value.length) % matchPositions.value.length;
  scrollToActiveMatch();
}

function scrollToActiveMatch() {
  const match = matchPositions.value[activeMatchIdx.value];
  if (!match) return;
  nextTick(() => {
    const el = document.querySelector(`[data-match-line="${match.lineIdx}"]`);
    if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
  });
}

function clearFilter() {
  filterText.value = "";
}

function highlightLine(line: string, lineIdx: number): string {
  let escaped = line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  if (filterActive.value) {
    const term = filterText.value;
    const lowerLine = line.toLowerCase();
    const lowerTerm = term.toLowerCase();
    const parts: string[] = [];
    let lastIdx = 0;
    let idx = lowerLine.indexOf(lowerTerm);

    while (idx !== -1) {
      if (idx > lastIdx) {
        parts.push(escaped.slice(lastIdx, idx));
      }
      const isCurrentMatch =
        matchPositions.value[activeMatchIdx.value]?.lineIdx === lineIdx &&
        matchPositions.value[activeMatchIdx.value]?.start === idx;

      const matchClass = isCurrentMatch
        ? "bg-yellow-500/40 ring-1 ring-yellow-500/60 rounded-sm"
        : "bg-yellow-500/20 rounded-sm";

      parts.push(
        `<span class="${matchClass}" data-match-line="${lineIdx}">${escaped.slice(idx, idx + term.length)}</span>`,
      );
      lastIdx = idx + term.length;
      idx = lowerLine.indexOf(lowerTerm, lastIdx);
    }

    if (lastIdx < escaped.length) {
      parts.push(escaped.slice(lastIdx));
    }

    escaped = parts.join("");
  }

  if (!filterActive.value) {
    escaped = escaped.replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
      (match) => {
        let cls = "text-[#b5cea8]";
        if (match.startsWith('"')) {
          if (match.endsWith(":")) {
            cls = "text-[#9cdcfe]";
          } else {
            cls = "text-[#ce9178]";
          }
        } else if (/true|false/.test(match)) {
          cls = "text-[#569cd6]";
        } else if (/null/.test(match)) {
          cls = "text-[#569cd6]";
        }
        return `<span class="${cls}">${match}</span>`;
      },
    );
  }

  return escaped;
}

const filterInputRef = ref<HTMLInputElement | null>(null);

defineExpose({ expandAll, collapseAll, toggleAll, filterInputRef });
</script>

<template>
  <div class="flex flex-col h-full">
    <div class="flex items-center gap-1.5 px-2 py-1.5 border-b border-border/20 shrink-0">
      <Search :size="12" class="text-muted-foreground/40 shrink-0" />
      <input
        ref="filterInputRef"
        v-model="filterText"
        class="flex-1 bg-transparent text-xs font-mono outline-none placeholder:text-muted-foreground/30"
        placeholder="Filter JSON…"
        @keydown.enter.prevent="nextMatch()"
        @keydown.shift.enter.prevent="prevMatch()"
        @keydown.arrow-down.prevent="nextMatch()"
        @keydown.arrow-up.prevent="prevMatch()"
        @keydown.escape="clearFilter()"
      />
      <span v-if="filterActive" class="text-[10px] text-muted-foreground/40 tabular-nums shrink-0">
        <template v-if="matchPositions.length > 0">
          {{ activeMatchIdx + 1 }} / {{ matchPositions.length }}
        </template>
        <template v-else>No matches</template>
      </span>
      <button
        v-if="filterActive"
        class="text-muted-foreground/40 hover:text-foreground transition-colors"
        @click="clearFilter()"
      >
        <X :size="12" />
      </button>
      <div class="w-px h-4 bg-border/30 mx-0.5" />
      <button
        class="flex items-center gap-1 text-xs text-muted-foreground/50 hover:text-foreground transition-colors shrink-0"
        @click="toggleAll()"
      >
        <ChevronsDownUp v-if="allCollapsed" :size="13" />
        <ChevronsUpDown v-else :size="13" />
        {{ allCollapsed ? "Expand" : "Collapse" }}
      </button>
    </div>

    <div class="flex flex-1 overflow-hidden text-sm font-mono leading-5">
      <div
        v-if="!hideLineNumbers"
        class="flex-shrink-0 text-right pr-3 text-muted-foreground/30 border-r border-border/20 overflow-hidden"
      >
        <div v-for="(_, i) in Array.from({ length: lineCount })" :key="i" class="h-5">
          {{ i + 1 }}
        </div>
      </div>
      <div class="flex-1 overflow-auto select-text">
        <div
          v-for="{ line, idx } in getVisibleLines()"
          :key="idx"
          class="relative h-5 whitespace-pre pl-5 select-text"
          :class="{ 'bg-yellow-500/5': matchLines.includes(idx) }"
        >
          <button
            v-if="line.isCollapsible"
            class="absolute left-0 top-0 w-5 cursor-pointer h-5 flex items-center justify-center text-muted-foreground/40 hover:text-muted-foreground transition-colors"
            @click="toggleCollapse(idx)"
          >
            <ChevronRight v-if="isCollapsed(idx)" :size="12" />
            <ChevronDown v-else :size="12" />
          </button>
          <span class="cursor-text select-text px-1" v-html="highlightLine(line.raw, idx)"></span>
        </div>
      </div>
    </div>
  </div>
</template>
