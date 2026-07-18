<script setup lang="ts">
import { ref, computed, watch, nextTick, shallowRef } from "vue";
import { Search, RefreshCw, MousePointer2 } from "lucide-vue-next";
import type { ComputedStyle, BoxModel } from "@/types/inspect.types";
import BoxModelDiagram from "@/shared/components/presentation/BoxModelDiagram.vue";

const props = defineProps<{
  /** Getter for the live iframe Document — called on Refresh */
  getDoc: (() => Document | null) | null;
  /** Element selected by clicking in the replay player viewport */
  externalSelectedEl: Element | null;
}>();

// ── Flat DOM tree ─────────────────────────────────────────────────────────────

interface FlatDomNode {
  el: Element;
  depth: number;
  tag: string;
  idAttr: string;
  cls: string;
  hasChildren: boolean;
  /** Short text content shown inline for leaf elements */
  textPreview: string | null;
}

const flatTree = ref<FlatDomNode[]>([]);
/** Elements whose children are hidden. Replaced (not mutated) to trigger reactivity. */
const collapsedEls = ref<Set<Element>>(new Set());
/** Currently highlighted/selected DOM node */
const selectedEl = shallowRef<Element | null>(null);
const treeRef = ref<HTMLElement | null>(null);
const snapshotTime = ref<string | null>(null);

// ── Tree build ────────────────────────────────────────────────────────────────

function buildFlat(root: Element): FlatDomNode[] {
  const result: FlatDomNode[] = [];
  function walk(el: Element, depth: number) {
    let textPreview: string | null = null;
    if (el.children.length === 0) {
      const t = el.textContent?.trim();
      if (t) textPreview = t.length > 80 ? t.slice(0, 80) + "…" : t;
    }
    result.push({
      el,
      depth,
      tag: el.tagName.toLowerCase(),
      idAttr: el.id ?? "",
      cls: typeof el.className === "string" ? el.className.trim() : "",
      hasChildren: el.children.length > 0,
      textPreview,
    });
    if (!collapsedEls.value.has(el)) {
      for (const child of el.children) walk(child as Element, depth + 1);
    }
  }
  walk(root, 0);
  return result;
}

function refreshTree() {
  const doc = props.getDoc?.();
  if (!doc?.documentElement) return;
  // Collapse <head> by default — start at body content
  const initial = new Set<Element>();
  const head = doc.querySelector("head");
  if (head) initial.add(head);
  collapsedEls.value = initial;
  flatTree.value = buildFlat(doc.documentElement);
  snapshotTime.value = new Date().toLocaleTimeString();
}

function toggleCollapse(el: Element) {
  const doc = props.getDoc?.();
  if (!doc?.documentElement) return;
  const next = new Set(collapsedEls.value);
  if (next.has(el)) next.delete(el);
  else next.add(el);
  collapsedEls.value = next;
  flatTree.value = buildFlat(doc.documentElement);
}

// ── Node selection ────────────────────────────────────────────────────────────

function selectNode(node: FlatDomNode) {
  selectedEl.value = node.el;
  extractInspectData(node.el);
}

function dotCls(cls: string): string {
  return cls.split(/\s+/).filter(Boolean).slice(0, 3).join(".");
}

// ── Dock: inspect data ────────────────────────────────────────────────────────

type DockTab = "computed" | "boxmodel" | "attrs";
const dockTab = ref<DockTab>("computed");
const filter = ref("");
const showAll = ref(false);

const computedStyles = ref<ComputedStyle[]>([]);
const attrsData = ref<Array<{ name: string; value: string }>>([]);
const elWidth = ref(0);
const elHeight = ref(0);

const boxModel = computed<BoxModel | null>(() =>
  selectedEl.value
    ? {
        width: elWidth.value,
        height: elHeight.value,
        content: [],
        padding: [],
        border: [],
        margin: [],
      }
    : null,
);

function extractInspectData(el: Element) {
  const doc = props.getDoc?.();
  const win = doc?.defaultView;

  // Attributes
  const list: Array<{ name: string; value: string }> = [];
  for (let i = 0; i < el.attributes.length; i++) {
    const a = el.attributes[i];
    list.push({ name: a.name, value: a.value });
  }
  attrsData.value = list;

  // Computed styles via iframe's own Window (same-origin)
  if (win) {
    const cs = win.getComputedStyle(el as HTMLElement);
    const styles: ComputedStyle[] = [];
    for (let i = 0; i < cs.length; i++) {
      const name = cs[i];
      styles.push({ name, value: cs.getPropertyValue(name) });
    }
    computedStyles.value = styles;
  } else {
    computedStyles.value = [];
  }

  // Box dimensions
  const rect = (el as HTMLElement).getBoundingClientRect();
  elWidth.value = Math.round(rect.width);
  elHeight.value = Math.round(rect.height);
}

const filteredStyles = computed<ComputedStyle[]>(() => {
  let list = computedStyles.value;
  if (filter.value) {
    const q = filter.value.toLowerCase();
    list = list.filter(
      (s) => s.name.toLowerCase().includes(q) || s.value.toLowerCase().includes(q),
    );
  }
  if (!showAll.value) {
    list = list.filter(
      (s) =>
        s.value &&
        s.value !== "none" &&
        s.value !== "normal" &&
        s.value !== "auto" &&
        s.value !== "0px",
    );
  }
  return list;
});

// ── External selection sync (from player click) ───────────────────────────────

function scrollToEl(el: Element) {
  nextTick(() => {
    const idx = flatTree.value.findIndex((n) => n.el === el);
    if (idx >= 0 && treeRef.value) {
      (treeRef.value.children[idx] as HTMLElement | undefined)?.scrollIntoView({
        block: "center",
        behavior: "smooth",
      });
    }
  });
}

watch(
  () => props.externalSelectedEl,
  (el) => {
    if (!el) return;
    const doc = props.getDoc?.();
    if (!doc?.documentElement) return;

    // Auto-snapshot if tree is empty
    if (flatTree.value.length === 0) {
      const initial = new Set<Element>();
      const head = doc.querySelector("head");
      if (head) initial.add(head);
      collapsedEls.value = initial;
      snapshotTime.value = new Date().toLocaleTimeString();
    }

    // Expand every ancestor so the element is visible
    const next = new Set(collapsedEls.value);
    let parent = el.parentElement;
    while (parent) {
      next.delete(parent);
      if (parent === doc.documentElement) break;
      parent = parent.parentElement;
    }
    collapsedEls.value = next;
    flatTree.value = buildFlat(doc.documentElement);

    selectedEl.value = el;
    extractInspectData(el);
    scrollToEl(el);
  },
);
</script>

<template>
  <div class="flex flex-col h-full min-h-0 bg-background">
    <!-- ── No session state ─────────────────────────────────── -->
    <div
      v-if="!getDoc"
      class="flex-1 flex items-center justify-center text-muted-foreground/40 text-[11px]"
    >
      No session loaded
    </div>

    <template v-else>
      <!-- ── Tree header ──────────────────────────────────────── -->
      <div
        class="flex-none flex items-center gap-2 px-3 py-1.5 border-b border-border/20 bg-surface-1 text-[11px]"
      >
        <span class="flex-1 text-muted-foreground/50 truncate">
          <span v-if="snapshotTime">Snapshot @ {{ snapshotTime }}</span>
          <span v-else class="italic text-muted-foreground/30">Click Refresh to load DOM tree</span>
        </span>
        <button
          class="flex items-center gap-1 px-1.5 py-0.5 rounded text-muted-foreground/50 hover:text-foreground hover:bg-surface-2 transition-colors shrink-0"
          title="Re-read current DOM from the replay iframe"
          @click="refreshTree"
        >
          <RefreshCw class="w-3 h-3" />
          Refresh
        </button>
      </div>

      <!-- ── DOM tree ─────────────────────────────────────────── -->
      <div
        ref="treeRef"
        class="flex-1 min-h-0 overflow-auto font-mono text-[11px] leading-relaxed select-none"
      >
        <!-- Tree rows -->
        <div
          v-for="(node, i) in flatTree"
          :key="i"
          class="flex items-center gap-0.5 py-px cursor-pointer hover:bg-surface-2 rounded-sm"
          :class="selectedEl === node.el ? 'bg-sky-500/10 hover:bg-sky-500/15' : ''"
          :style="{ paddingLeft: `${node.depth * 12 + 4}px`, paddingRight: '8px' }"
          @click="selectNode(node)"
        >
          <!-- Expand/collapse arrow -->
          <button
            v-if="node.hasChildren"
            class="w-3 h-3 shrink-0 flex items-center justify-center text-[9px] text-muted-foreground/40 hover:text-foreground/70"
            @click.stop="toggleCollapse(node.el)"
          >
            {{ collapsedEls.has(node.el) ? "▶" : "▼" }}
          </button>
          <span v-else class="w-3 shrink-0" />

          <!-- Tag -->
          <span :class="selectedEl === node.el ? 'text-foreground' : 'text-muted-foreground/70'">
            <span class="text-sky-400">&lt;{{ node.tag }}</span>
            <span v-if="node.idAttr" class="text-violet-400">#{{ node.idAttr }}</span>
            <span v-if="dotCls(node.cls)" class="text-amber-400/80">.{{ dotCls(node.cls) }}</span>
            <span class="text-sky-400">&gt;</span>
          </span>

          <!-- Leaf text content -->
          <span
            v-if="node.textPreview"
            class="ml-1.5 text-muted-foreground/40 truncate max-w-[180px]"
            >"{{ node.textPreview }}"</span
          >

          <!-- Collapsed children indicator -->
          <span
            v-if="node.hasChildren && collapsedEls.has(node.el)"
            class="ml-1 text-muted-foreground/25 text-[10px]"
            >…</span
          >
        </div>

        <!-- Empty state -->
        <div
          v-if="flatTree.length === 0"
          class="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground/40"
        >
          <MousePointer2 class="w-5 h-5" />
          <p class="text-[11px] text-center leading-relaxed">
            Click <span class="font-semibold">Refresh</span> to snapshot the DOM,<br />
            or click an element in Inspect mode.
          </p>
        </div>
      </div>

      <!-- ── Dock ──────────────────────────────────────────────── -->
      <div class="flex-none border-t border-border/40 bg-surface-1">
        <!-- Selected element badge -->
        <div
          class="px-3 py-1.5 border-b border-border/20 font-mono text-[11px] truncate min-h-[28px] flex items-center"
        >
          <template v-if="selectedEl">
            <span class="text-sky-400 font-semibold">{{ selectedEl.tagName.toLowerCase() }}</span>
            <span v-if="(selectedEl as HTMLElement).id" class="text-violet-400"
              >#{{ (selectedEl as HTMLElement).id }}</span
            >
            <span
              v-if="
                selectedEl.className &&
                typeof selectedEl.className === 'string' &&
                selectedEl.className.trim()
              "
              class="text-amber-400/80"
              >.{{ dotCls((selectedEl as HTMLElement).className) }}</span
            >
            <span class="ml-2 text-muted-foreground/40">{{ elWidth }}×{{ elHeight }}px</span>
          </template>
          <span v-else class="text-muted-foreground/30 italic">No element selected</span>
        </div>

        <!-- Dock tab bar -->
        <div class="flex border-b border-border/20 text-[11px]">
          <button
            class="flex-1 py-1 font-medium transition-colors"
            :class="
              dockTab === 'computed'
                ? 'text-foreground border-b-2 border-brand'
                : 'text-muted-foreground/50 hover:text-foreground'
            "
            @click="dockTab = 'computed'"
          >
            Computed
          </button>
          <button
            class="flex-1 py-1 font-medium transition-colors"
            :class="
              dockTab === 'boxmodel'
                ? 'text-foreground border-b-2 border-brand'
                : 'text-muted-foreground/50 hover:text-foreground'
            "
            @click="dockTab = 'boxmodel'"
          >
            Box Model
          </button>
          <button
            class="flex-1 py-1 font-medium transition-colors"
            :class="
              dockTab === 'attrs'
                ? 'text-foreground border-b-2 border-brand'
                : 'text-muted-foreground/50 hover:text-foreground'
            "
            @click="dockTab = 'attrs'"
          >
            Attrs
          </button>
        </div>

        <!-- Dock content — fixed height -->
        <div class="h-48 overflow-auto">
          <!-- Computed styles -->
          <div v-if="dockTab === 'computed'" class="flex flex-col h-full font-mono text-[11px]">
            <div
              class="flex items-center gap-1 px-2 py-1 border-b border-border/20 sticky top-0 bg-surface-1 z-10"
            >
              <Search class="w-3 h-3 text-muted-foreground/40 shrink-0" />
              <input
                v-model="filter"
                placeholder="Filter properties…"
                class="flex-1 bg-transparent text-[11px] outline-none placeholder:text-muted-foreground/30"
              />
              <label
                class="flex items-center gap-1 text-[10px] text-muted-foreground/50 cursor-pointer shrink-0"
              >
                <input v-model="showAll" type="checkbox" class="w-3 h-3" />
                All
              </label>
            </div>
            <div class="overflow-auto p-1 space-y-px">
              <div
                v-for="s in filteredStyles"
                :key="s.name"
                class="flex gap-1 py-px hover:bg-surface-2 px-1 rounded"
              >
                <span class="text-blue-400 shrink-0">{{ s.name }}</span>
                <span class="text-muted-foreground/50">:</span>
                <span class="text-foreground/80 truncate">{{ s.value }}</span>
              </div>
              <div v-if="!selectedEl" class="text-muted-foreground/30 text-center py-4">
                Select an element
              </div>
              <div
                v-else-if="filteredStyles.length === 0"
                class="text-muted-foreground/30 text-center py-4"
              >
                No matching styles
              </div>
            </div>
          </div>

          <!-- Box model -->
          <div v-else-if="dockTab === 'boxmodel'">
            <BoxModelDiagram :box-model="boxModel" :computed-styles="computedStyles" />
          </div>

          <!-- Attributes -->
          <div v-else class="p-1 font-mono text-[11px] space-y-px">
            <div
              v-for="a in attrsData"
              :key="a.name"
              class="flex gap-1 py-px hover:bg-surface-2 px-1 rounded min-w-0"
            >
              <span class="text-amber-400 shrink-0">{{ a.name }}</span>
              <span class="text-muted-foreground/50">=</span>
              <span class="text-green-400/80 truncate">"{{ a.value }}"</span>
            </div>
            <div v-if="!selectedEl" class="text-muted-foreground/30 text-center py-4">
              Select an element
            </div>
            <div
              v-else-if="attrsData.length === 0"
              class="text-muted-foreground/30 text-center py-4"
            >
              No attributes
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
