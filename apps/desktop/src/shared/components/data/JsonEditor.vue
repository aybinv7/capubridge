<script setup lang="ts">
import { computed, ref, watch, nextTick } from "vue";
import {
  ChevronRight,
  ChevronDown,
  Search,
  X,
  ChevronsDownUp,
  ChevronsUpDown,
} from "lucide-vue-next";

const props = defineProps<{
  value: string;
  readonly?: boolean;
  lineClass?: (lineIndex: number) => string;
  lineCharHighlight?: (
    lineIndex: number,
  ) => { ranges: [number, number][]; kind: "add" | "remove" } | null;
}>();

const emit = defineEmits<{
  "update:value": [value: string];
  "validity-change": [valid: boolean];
  scroll: [top: number];
}>();

// ─── JSON error ────────────────────────────────────────────────────────────────

type JsonError = { line: number; message: string } | null;

const jsonError = computed<JsonError>(() => {
  const v = props.value.trim();
  if (!v) return null;
  try {
    JSON.parse(v);
    return null;
  } catch (e: unknown) {
    const msg = e instanceof SyntaxError ? e.message : String(e);
    let line = -1;
    const lineMatch = msg.match(/line\s+(\d+)/i);
    const posMatch = msg.match(/position\s+(\d+)/i);
    if (lineMatch) line = parseInt(lineMatch[1]!) - 1;
    else if (posMatch) {
      const pos = parseInt(posMatch[1]!);
      line = props.value.substring(0, pos).split("\n").length - 1;
    }
    return { line, message: msg };
  }
});

const isValid = computed(() => jsonError.value === null);
watch(isValid, (v) => emit("validity-change", v));

// ─── Line data ─────────────────────────────────────────────────────────────────

const rawLines = computed(() =>
  props.value.split("\n").map((line) => {
    const indent = line.search(/\S/);
    const trimmed = line.trimStart();
    const isCollapsible = trimmed.endsWith("{") || trimmed.endsWith("[");
    return { raw: line, indent: Math.max(0, indent), trimmed, isCollapsible };
  }),
);

// ─── Collapse state ────────────────────────────────────────────────────────────
// Collapse is PURELY a display/preview concept. When any section is collapsed
// we switch to a read-only rendered view (no textarea). This avoids the
// impossible problem of keeping a textarea cursor/selection in sync with a
// collapsed virtual view — the textarea always holds the full unmodified text.

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

const isCollapsed = (idx: number) => collapsedIndices.value.has(idx);
const isAnyCollapsed = computed(() => collapsedIndices.value.size > 0);

const collapsibleIndices = computed(() =>
  rawLines.value.reduce<number[]>((acc, l, i) => {
    if (l.isCollapsible) acc.push(i);
    return acc;
  }, []),
);

const allCollapsed = computed(
  () =>
    collapsibleIndices.value.length > 0 &&
    collapsibleIndices.value.every((i) => collapsedIndices.value.has(i)),
);

function expandAll() {
  collapsedIndices.value = new Set();
}
function collapseAll() {
  collapsedIndices.value = new Set(collapsibleIndices.value);
}
function toggleAll() {
  if (allCollapsed.value) {
    expandAll();
  } else {
    collapseAll();
  }
}

// Visible items for preview mode
const visibleItems = computed(() => {
  const result: {
    line: (typeof rawLines.value)[number];
    idx: number;
    displayLine: number;
  }[] = [];
  let skipUntilIndent = -1;
  let displayLine = 1;
  for (let i = 0; i < rawLines.value.length; i++) {
    const line = rawLines.value[i]!;
    if (skipUntilIndent >= 0) {
      if (line.indent > skipUntilIndent) continue;
      skipUntilIndent = -1;
    }
    result.push({ line, idx: i, displayLine });
    displayLine++;
    if (isCollapsed(i) && line.isCollapsible) {
      skipUntilIndent = line.indent;
    }
  }
  return result;
});

// ─── Filter / search ───────────────────────────────────────────────────────────

const filterText = ref("");
const filterActive = computed(() => filterText.value.length > 0);

const matchPositions = computed(() => {
  const term = filterText.value.toLowerCase();
  if (!term) return [];
  const out: { lineIdx: number; start: number; end: number }[] = [];
  for (let i = 0; i < rawLines.value.length; i++) {
    const lower = rawLines.value[i]!.raw.toLowerCase();
    let idx = lower.indexOf(term);
    while (idx !== -1) {
      out.push({ lineIdx: i, start: idx, end: idx + term.length });
      idx = lower.indexOf(term, idx + 1);
    }
  }
  return out;
});

const matchLineSet = computed(() => new Set(matchPositions.value.map((m) => m.lineIdx)));
const activeMatchIdx = ref(0);
watch(filterText, () => {
  activeMatchIdx.value = 0;
});

function nextMatch() {
  if (!matchPositions.value.length) return;
  activeMatchIdx.value = (activeMatchIdx.value + 1) % matchPositions.value.length;
  scrollToMatch();
}
function prevMatch() {
  if (!matchPositions.value.length) return;
  activeMatchIdx.value =
    (activeMatchIdx.value - 1 + matchPositions.value.length) % matchPositions.value.length;
  scrollToMatch();
}
function clearFilter() {
  filterText.value = "";
}

// Line height matches `leading-5` (h-5 = 20px).
const LINE_HEIGHT = 20;

// Scroll the textarea directly to the matched line so the overlay stays in sync.
// Using scrollIntoView on overlay spans caused the textarea scroll position to
// diverge, making the next user wheel-scroll jump back to line 1.
function scrollToMatch() {
  const m = matchPositions.value[activeMatchIdx.value];
  if (!m) return;
  nextTick(() => {
    const ta = textareaRef.value;
    if (!ta) return;
    const targetTop = m.lineIdx * LINE_HEIGHT;
    const center = Math.max(0, targetTop - ta.clientHeight / 2 + LINE_HEIGHT / 2);
    ta.scrollTop = center;
    syncScroll();
  });
}

// ─── Syntax highlight ──────────────────────────────────────────────────────────

function escHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const JSON_RE =
  /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g;

// Build HTML for a line with character ranges highlighted. Works on raw string
// so HTML escaping is applied per-segment (avoids entity-position mismatches).
function highlightCharRanges(raw: string, ranges: [number, number][], cls: string): string {
  if (ranges.length === 0) return escHtml(raw);
  const parts: string[] = [];
  let last = 0;
  for (const [start, end] of ranges) {
    if (start > last) parts.push(escHtml(raw.slice(last, start)));
    parts.push(`<span class="${cls}">${escHtml(raw.slice(start, end))}</span>`);
    last = end;
  }
  if (last < raw.length) parts.push(escHtml(raw.slice(last)));
  return parts.join("");
}

function highlightLine(raw: string, lineIdx: number): string {
  let e = escHtml(raw);

  if (filterActive.value) {
    const term = filterText.value;
    const lowerRaw = raw.toLowerCase();
    const lowerTerm = term.toLowerCase();
    const parts: string[] = [];
    let last = 0,
      idx = lowerRaw.indexOf(lowerTerm);
    while (idx !== -1) {
      if (idx > last) parts.push(e.slice(last, idx));
      const cur =
        matchPositions.value[activeMatchIdx.value]?.lineIdx === lineIdx &&
        matchPositions.value[activeMatchIdx.value]?.start === idx;
      parts.push(
        `<span class="${
          cur
            ? "bg-yellow-500/40 ring-1 ring-yellow-500/60 rounded-sm"
            : "bg-yellow-500/20 rounded-sm"
        }" data-match-line="${lineIdx}">${e.slice(idx, idx + term.length)}</span>`,
      );
      last = idx + term.length;
      idx = lowerRaw.indexOf(lowerTerm, last);
    }
    parts.push(e.slice(last));
    return parts.join("");
  }

  // Char-level diff highlighting (from parent diff viewer) takes priority over
  // syntax coloring so the changed characters are immediately visible.
  const charHighlight = props.lineCharHighlight?.(lineIdx);
  if (charHighlight && charHighlight.ranges.length > 0) {
    const cls =
      charHighlight.kind === "add"
        ? "bg-emerald-500/40 rounded-[1px]"
        : "bg-red-500/40 rounded-[1px]";
    return highlightCharRanges(raw, charHighlight.ranges, cls);
  }

  return e.replace(JSON_RE, (m) => {
    let cls = "text-[#b5cea8]";
    if (m.startsWith('"')) cls = m.endsWith(":") ? "text-[#9cdcfe]" : "text-[#ce9178]";
    else if (/true|false/.test(m)) cls = "text-[#569cd6]";
    else if (/null/.test(m)) cls = "text-[#569cd6]";
    return `<span class="${cls}">${m}</span>`;
  });
}

// ─── Scroll sync (edit mode) ───────────────────────────────────────────────────

const textareaRef = ref<HTMLTextAreaElement | null>(null);
const overlayRef = ref<HTMLElement | null>(null);
const lineNumbersRef = ref<HTMLElement | null>(null);
const filterInputRef = ref<HTMLInputElement | null>(null);
const previewScrollRef = ref<HTMLElement | null>(null);

// Used by gutter translateY — reactive scroll position
const taScrollTop = ref(0);

// Tracks the last scroll position we emitted so we only emit on actual changes.
// This breaks the circular chain when two editors sync each other:
// A scrolls → emits → B.setScrollTop → emits → A.setScrollTop → no-op (same value).
let _lastScrollTop = -1;

function syncScroll() {
  if (!textareaRef.value) return;
  const { scrollTop, scrollLeft } = textareaRef.value;
  taScrollTop.value = scrollTop;
  if (overlayRef.value) {
    overlayRef.value.scrollTop = scrollTop;
    overlayRef.value.scrollLeft = scrollLeft;
  }
  if (lineNumbersRef.value) {
    lineNumbersRef.value.scrollTop = scrollTop;
  }
  if (scrollTop !== _lastScrollTop) {
    _lastScrollTop = scrollTop;
    emit("scroll", scrollTop);
  }
}

// Called by a parent (e.g. JsonDiffViewer) to synchronise scroll position.
function setScrollTop(top: number) {
  if (!textareaRef.value) return;
  textareaRef.value.scrollTop = top;
  syncScroll();
}

function handleWheel(e: WheelEvent) {
  if (Math.abs(e.deltaY) <= 0) return;
  if (isAnyCollapsed.value) {
    const preview = previewScrollRef.value;
    if (!preview) return;
    e.preventDefault();
    preview.scrollTop += e.deltaY;
    preview.scrollLeft += e.deltaX;
    return;
  }

  const textarea = textareaRef.value;
  if (!textarea) return;
  e.preventDefault();
  textarea.scrollTop += e.deltaY;
  textarea.scrollLeft += e.deltaX;
  syncScroll();
}

function onTextareaInput(e: Event) {
  if (props.readonly) return;
  emit("update:value", (e.target as HTMLTextAreaElement).value);
}

function handleTab(e: KeyboardEvent) {
  if (e.key !== "Tab") return;
  if (props.readonly) return;
  e.preventDefault();
  const ta = textareaRef.value!;
  const s = ta.selectionStart,
    end = ta.selectionEnd;
  ta.value = ta.value.substring(0, s) + "  " + ta.value.substring(end);
  ta.selectionStart = ta.selectionEnd = s + 2;
  emit("update:value", ta.value);
}

defineExpose({
  expandAll,
  collapseAll,
  toggleAll,
  textareaRef,
  filterInputRef,
  isValid,
  setScrollTop,
});
</script>

<template>
  <div class="flex h-full min-h-0 flex-col overflow-hidden" @wheel="handleWheel">
    <!-- toolbar -->
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
        <template v-if="matchPositions.length > 0"
          >{{ activeMatchIdx + 1 }} / {{ matchPositions.length }}</template
        >
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

    <!-- ═══════════════════════════════════════════════════════════════════════
         PREVIEW MODE  (one or more sections collapsed)
         Read-only. Clicking anywhere outside a toggle button → expandAll().
         Line numbers reflect only visible (display) lines, not raw line nums.
         ═══════════════════════════════════════════════════════════════════════ -->
    <div v-if="isAnyCollapsed" class="flex flex-1 overflow-hidden text-sm font-mono leading-5">
      <!-- line numbers (visible count only) -->
      <div
        class="flex-shrink-0 select-none text-right border-r border-border/20 overflow-y-auto overflow-x-hidden"
        :style="{ width: `${String(visibleItems.length).length * 8 + 28}px` }"
      >
        <div
          v-for="item in visibleItems"
          :key="item.idx"
          class="h-5 leading-5 pr-3"
          :class="
            jsonError && jsonError.line === item.idx
              ? 'text-red-400/80'
              : 'text-muted-foreground/30'
          "
        >
          {{ item.displayLine }}
        </div>
      </div>

      <!-- rendered lines -->
      <div ref="previewScrollRef" class="flex-1 overflow-auto cursor-text" @click="expandAll()">
        <div
          v-for="item in visibleItems"
          :key="item.idx"
          class="h-5 leading-5 whitespace-pre relative pl-5 pr-4"
          :class="[
            props.lineClass?.(item.idx),
            {
              'bg-yellow-500/5': matchLineSet.has(item.idx),
              'bg-red-500/8': jsonError && jsonError.line === item.idx,
            },
          ]"
          @click.stop
        >
          <!-- collapse toggle -->
          <button
            v-if="item.line.isCollapsible"
            class="absolute left-0 top-0 w-5 h-5 flex items-center justify-center text-muted-foreground/40 hover:text-muted-foreground transition-colors cursor-pointer z-10"
            @click.stop="toggleCollapse(item.idx)"
          >
            <ChevronRight v-if="isCollapsed(item.idx)" :size="12" />
            <ChevronDown v-else :size="12" />
          </button>

          <span v-html="highlightLine(item.line.raw, item.idx)" />

          <!-- collapsed placeholder -->
          <span v-if="isCollapsed(item.idx)" class="text-muted-foreground/30 text-xs select-none">
            … }</span
          >

          <!-- error annotation -->
          <span
            v-if="jsonError && jsonError.line === item.idx"
            class="ml-3 text-[10px] text-red-400/60 font-sans"
            :title="jsonError.message"
            >⚠ {{ jsonError.message }}</span
          >
        </div>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════════════════
         EDIT MODE  (nothing collapsed)
         Full textarea + overlay stack. Line numbers = all raw lines.
         ═══════════════════════════════════════════════════════════════════════ -->
    <div v-else class="flex flex-1 overflow-hidden text-sm font-mono leading-5">
      <!-- line numbers -->
      <div
        ref="lineNumbersRef"
        class="flex-shrink-0 select-none text-right border-r border-border/20 overflow-hidden pointer-events-none"
        :style="{ width: `${String(rawLines.length).length * 8 + 28}px` }"
      >
        <div
          v-for="(_, i) in rawLines.length"
          :key="i"
          class="h-5 leading-5 pr-3"
          :class="
            jsonError && jsonError.line === i ? 'text-red-400/80' : 'text-muted-foreground/30'
          "
        >
          {{ i + 1 }}
        </div>
      </div>

      <!-- code area -->
      <div class="flex-1 relative overflow-hidden">
        <!-- layer 1: syntax highlight overlay -->
        <div
          ref="overlayRef"
          class="absolute inset-0 overflow-hidden pointer-events-none select-none"
          aria-hidden="true"
        >
          <div>
            <div
              v-for="(line, i) in rawLines"
              :key="i"
              class="h-5 leading-5 whitespace-pre pl-5 pr-4"
              :class="[
                props.lineClass?.(i),
                {
                  'bg-yellow-500/5': matchLineSet.has(i),
                  'bg-red-500/8': jsonError && jsonError.line === i,
                },
              ]"
            >
              <span v-html="highlightLine(line.raw, i)" />
              <span
                v-if="jsonError && jsonError.line === i"
                class="ml-3 text-[10px] text-red-400/60 font-sans"
                :title="jsonError.message"
                >⚠ {{ jsonError.message }}</span
              >
            </div>
          </div>
        </div>

        <!-- layer 2: textarea -->
        <textarea
          ref="textareaRef"
          :value="value"
          :readonly="readonly"
          class="absolute inset-0 w-full h-full bg-transparent text-transparent caret-foreground font-mono text-sm leading-5 pl-5 pr-4 py-0 resize-none outline-none whitespace-pre overflow-auto [&::selection]:bg-white/15"
          spellcheck="false"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
          @input="onTextareaInput"
          @scroll="syncScroll"
          @keydown="handleTab"
        />

        <!-- layer 3: collapse toggle gutter (20px strip, above textarea) -->
        <div
          class="absolute inset-y-0 left-0 w-5 overflow-hidden pointer-events-none"
          aria-hidden="true"
        >
          <div
            class="will-change-transform"
            :style="{ transform: `translateY(-${taScrollTop}px)` }"
          >
            <div v-for="(line, i) in rawLines" :key="i" class="h-5 relative">
              <button
                v-if="line.isCollapsible"
                class="absolute inset-0 flex items-center justify-center text-muted-foreground/40 hover:text-muted-foreground transition-colors pointer-events-auto cursor-pointer"
                @click="toggleCollapse(i)"
              >
                <ChevronDown :size="12" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
