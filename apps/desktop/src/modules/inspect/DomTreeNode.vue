<script setup lang="ts">
import { computed, ref, nextTick, watch } from "vue";
import { ChevronRight } from "lucide-vue-next";
import { toast } from "vue-sonner";
import type { DOMNode, DOMAttribute } from "@/types/inspect.types";
import { useInspectStore } from "@/stores/inspect.store";
import { useElementMutations } from "./useElementMutations";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

const props = defineProps<{
  node: DOMNode;
  depth: number;
}>();

const emit = defineEmits<{
  select: [nodeId: number];
  expand: [nodeId: number];
  hover: [nodeId: number];
  unhover: [];
  editAsHtml: [nodeId: number];
}>();

const store = useInspectStore();
const mutations = useElementMutations();

const isExpanded = computed(() => store.expandedNodes.has(props.node.nodeId));
const isSelected = computed(() => store.selectedNodeId === props.node.nodeId);
const hasChildren = computed(
  () => (props.node.childNodeCount ?? 0) > 0 || (props.node.children?.length ?? 0) > 0,
);

const attributes = computed<DOMAttribute[]>(() => {
  const attrs: DOMAttribute[] = [];
  const raw = props.node.attributes ?? [];
  for (let i = 0; i < raw.length; i += 2) {
    attrs.push({ name: raw[i], value: raw[i + 1] });
  }
  return attrs;
});

const visibleChildren = computed(() => {
  if (!props.node.children) return [];
  return props.node.children.filter((c) => {
    if (c.nodeType === 1) return true;
    if (c.nodeType === 3) return c.nodeValue.trim().length > 0;
    return false;
  });
});

const inlineText = computed(() => {
  if (!props.node.children) return null;
  if (props.node.children.length === 1 && props.node.children[0].nodeType === 3) {
    const text = props.node.children[0].nodeValue.trim();
    return text.length <= 80 ? text : null;
  }
  return null;
});

const inlineTextNodeId = computed(() => {
  if (inlineText.value && props.node.children) return props.node.children[0].nodeId;
  return null;
});

const isElement = computed(() => props.node.nodeType === 1);
const isText = computed(() => props.node.nodeType === 3);

type EditKind =
  | { kind: "tag" }
  | { kind: "attr-name"; original: string }
  | { kind: "attr-value"; name: string }
  | { kind: "new-attr" }
  | { kind: "text"; nodeId: number };

const editing = ref<EditKind | null>(null);
const draft = ref("");
const editInput = ref<HTMLInputElement | null>(null);

function startEdit(kind: EditKind, initial: string) {
  editing.value = kind;
  draft.value = initial;
  nextTick(() => {
    editInput.value?.focus();
    editInput.value?.select();
  });
}

async function commitEdit() {
  const e = editing.value;
  if (!e) return;
  editing.value = null;
  const value = draft.value;

  try {
    if (e.kind === "attr-name") {
      const trimmed = value.trim();
      if (!trimmed) {
        await mutations.removeAttribute(props.node.nodeId, e.original);
      } else if (trimmed !== e.original) {
        const existing = attributes.value.find((a) => a.name === e.original);
        await mutations.setAttributesAsText(
          props.node.nodeId,
          `${trimmed}="${(existing?.value ?? "").replace(/"/g, "&quot;")}"`,
          e.original,
        );
      }
    } else if (e.kind === "attr-value") {
      await mutations.setAttribute(props.node.nodeId, e.name, value);
    } else if (e.kind === "new-attr") {
      const trimmed = value.trim();
      if (trimmed) await mutations.setAttributesAsText(props.node.nodeId, trimmed);
    } else if (e.kind === "text") {
      await mutations.setTextNodeValue(e.nodeId, value);
    } else if (e.kind === "tag") {
      const html = await mutations.getOuterHTML(props.node.nodeId);
      const newTag = value.trim();
      if (html && newTag && newTag !== props.node.localName) {
        const oldTag = props.node.localName;
        const next = html
          .replace(new RegExp(`^<${oldTag}`, "i"), `<${newTag}`)
          .replace(new RegExp(`</${oldTag}>\\s*$`, "i"), `</${newTag}>`);
        await mutations.setOuterHTML(props.node.nodeId, next);
      }
    }
  } catch (err) {
    toast.error(String(err));
  }
}

function cancelEdit() {
  editing.value = null;
}

function handleEditKey(e: KeyboardEvent) {
  if (e.key === "Enter") {
    e.preventDefault();
    commitEdit();
  } else if (e.key === "Escape") {
    e.preventDefault();
    cancelEdit();
  }
}

const isEditingTag = computed(() => editing.value?.kind === "tag");
const isEditingNewAttr = computed(() => editing.value?.kind === "new-attr");
function isEditingAttrName(name: string): boolean {
  const e = editing.value;
  return e?.kind === "attr-name" && e.original === name;
}
function isEditingAttrValue(name: string): boolean {
  const e = editing.value;
  return e?.kind === "attr-value" && e.name === name;
}
const isEditingText = computed(() => editing.value?.kind === "text");

async function copyText(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`Copied ${what}`);
  } catch {
    toast.error("Clipboard write failed");
  }
}

async function copyOuterHTML() {
  const html = await mutations.getOuterHTML(props.node.nodeId);
  if (html != null) await copyText(html, "outerHTML");
}

async function copyInnerHTML() {
  const html = await mutations.getOuterHTML(props.node.nodeId);
  if (html == null) return;
  const open = html.indexOf(">");
  const close = html.lastIndexOf("<");
  if (open >= 0 && close > open) await copyText(html.slice(open + 1, close), "innerHTML");
  else await copyText(html, "innerHTML");
}

async function copySelector() {
  const sel = await mutations.getCSSSelector(props.node.nodeId);
  if (sel) await copyText(sel, "selector");
}

async function copyXPath() {
  const xp = await mutations.getXPath(props.node.nodeId);
  if (xp) await copyText(xp, "XPath");
}

async function deleteNode() {
  await mutations.removeNode(props.node.nodeId);
}

async function duplicateNode() {
  await mutations.duplicateNode(props.node.nodeId);
}

async function scrollIntoView() {
  await mutations.scrollIntoView(props.node.nodeId);
}

async function hideElement() {
  await mutations.setAttribute(props.node.nodeId, "style", "display: none !important;");
}

function editAsHtml() {
  emit("editAsHtml", props.node.nodeId);
}

function collapseAll() {
  function walk(n: DOMNode) {
    store.expandedNodes.delete(n.nodeId);
    n.children?.forEach(walk);
  }
  walk(props.node);
}

function expandRecursively() {
  function walk(n: DOMNode) {
    if (n.nodeType === 1) {
      store.expandedNodes.add(n.nodeId);
      n.children?.forEach(walk);
    }
  }
  walk(props.node);
}

function onRowClick() {
  emit("select", props.node.nodeId);
  if (isElement.value && hasChildren.value && !inlineText.value && !isExpanded.value) {
    emit("expand", props.node.nodeId);
  }
}

const rowRef = ref<HTMLElement | null>(null);
const flash = ref(false);

watch(isSelected, async (sel) => {
  if (!sel) return;
  await nextTick();
  rowRef.value?.scrollIntoView({ block: "center", behavior: "smooth" });
  flash.value = true;
  setTimeout(() => {
    flash.value = false;
  }, 900);
});
</script>

<template>
  <div>
    <ContextMenu>
      <ContextMenuTrigger as-child>
        <div
          ref="rowRef"
          class="flex items-center gap-0 pr-2 h-6 cursor-pointer group transition-colors duration-300"
          :class="{
            'bg-blue-500/40 text-blue-200 ring-1 ring-blue-400/60': flash,
            'bg-blue-500/15 text-blue-300': isSelected && !flash,
            'hover:bg-surface-2': !isSelected,
          }"
          :style="{ paddingLeft: `${depth * 16 + 4}px` }"
          @click="onRowClick"
          @mouseenter="emit('hover', node.nodeId)"
          @mouseleave="emit('unhover')"
        >
          <button
            v-if="isElement && hasChildren && !inlineText"
            class="w-4 h-4 flex items-center justify-center shrink-0"
            @click.stop="emit('expand', node.nodeId)"
          >
            <ChevronRight
              class="w-3 h-3 text-muted-foreground/50 transition-transform"
              :class="{ 'rotate-90': isExpanded }"
            />
          </button>
          <div v-else class="w-4 shrink-0" />

          <template v-if="isElement">
            <span class="text-xs font-mono whitespace-nowrap overflow-hidden">
              <span class="text-purple-400">&lt;</span>
              <input
                v-if="isEditingTag"
                ref="editInput"
                v-model="draft"
                class="text-xs font-mono bg-surface-3 text-purple-300 outline-none px-0.5 rounded-sm border border-blue-400/40"
                :style="{ width: `${Math.max(draft.length, 2) + 1}ch` }"
                @click.stop
                @blur="commitEdit"
                @keydown="handleEditKey"
              />
              <span
                v-else
                class="text-purple-400 hover:bg-surface-3 rounded-sm"
                @dblclick.stop="startEdit({ kind: 'tag' }, node.localName)"
                >{{ node.localName }}</span
              >
              <template v-for="attr in attributes" :key="attr.name">
                <span class="text-muted-foreground"> </span>
                <input
                  v-if="isEditingAttrName(attr.name)"
                  ref="editInput"
                  v-model="draft"
                  class="text-xs font-mono bg-surface-3 text-yellow-300 outline-none px-0.5 rounded-sm border border-blue-400/40"
                  :style="{ width: `${Math.max(draft.length, 2) + 1}ch` }"
                  @click.stop
                  @blur="commitEdit"
                  @keydown="handleEditKey"
                />
                <span
                  v-else
                  class="text-yellow-400/70 hover:bg-surface-3 rounded-sm"
                  @dblclick.stop="startEdit({ kind: 'attr-name', original: attr.name }, attr.name)"
                  >{{ attr.name }}</span
                >
                <template v-if="attr.value">
                  <span class="text-muted-foreground">=</span>
                  <span class="text-green-400/70">"</span>
                  <input
                    v-if="isEditingAttrValue(attr.name)"
                    ref="editInput"
                    v-model="draft"
                    class="text-xs font-mono bg-surface-3 text-green-300 outline-none px-0.5 rounded-sm border border-blue-400/40"
                    :style="{ width: `${Math.max(draft.length, 4) + 1}ch` }"
                    @click.stop
                    @blur="commitEdit"
                    @keydown="handleEditKey"
                  />
                  <span
                    v-else
                    class="text-green-400/70 hover:bg-surface-3 rounded-sm"
                    @dblclick.stop="startEdit({ kind: 'attr-value', name: attr.name }, attr.value)"
                    >{{ attr.value }}</span
                  >
                  <span class="text-green-400/70">"</span>
                </template>
              </template>
              <template v-if="isEditingNewAttr">
                <span class="text-muted-foreground"> </span>
                <input
                  ref="editInput"
                  v-model="draft"
                  placeholder='attr="value"'
                  class="text-xs font-mono bg-surface-3 text-yellow-300 outline-none px-0.5 rounded-sm border border-blue-400/40"
                  :style="{ width: `${Math.max(draft.length, 10) + 1}ch` }"
                  @click.stop
                  @blur="commitEdit"
                  @keydown="handleEditKey"
                />
              </template>
              <span class="text-purple-400">&gt;</span>
              <input
                v-if="isEditingText && inlineTextNodeId !== null"
                ref="editInput"
                v-model="draft"
                class="text-xs font-mono bg-surface-3 text-foreground/90 outline-none px-0.5 mx-0.5 rounded-sm border border-blue-400/40"
                @click.stop
                @blur="commitEdit"
                @keydown="handleEditKey"
              />
              <template v-else>
                <span
                  v-if="inlineText"
                  class="text-foreground/70 hover:bg-surface-3 rounded-sm"
                  @dblclick.stop="
                    inlineTextNodeId !== null &&
                    startEdit({ kind: 'text', nodeId: inlineTextNodeId }, inlineText)
                  "
                  >{{ inlineText }}</span
                >
              </template>
              <span v-if="inlineText" class="text-purple-400">&lt;/{{ node.localName }}&gt;</span>
            </span>
          </template>

          <template v-if="isText">
            <input
              v-if="isEditingText"
              ref="editInput"
              v-model="draft"
              class="text-xs font-mono bg-surface-3 text-foreground/90 outline-none px-0.5 flex-1 rounded-sm border border-blue-400/40"
              @click.stop
              @blur="commitEdit"
              @keydown="handleEditKey"
            />
            <span
              v-else
              class="text-xs font-mono text-foreground/60 truncate hover:bg-surface-3 rounded-sm"
              @dblclick.stop="startEdit({ kind: 'text', nodeId: node.nodeId }, node.nodeValue)"
            >
              "{{ node.nodeValue.trim() }}"
            </span>
          </template>
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent class="w-56 text-xs">
        <ContextMenuItem :disabled="!isElement" @select="startEdit({ kind: 'new-attr' }, '')">
          Add attribute
        </ContextMenuItem>
        <ContextMenuItem :disabled="!isElement" @select="editAsHtml">Edit as HTML</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuSub>
          <ContextMenuSubTrigger>Copy</ContextMenuSubTrigger>
          <ContextMenuSubContent class="w-48 text-xs">
            <ContextMenuItem :disabled="!isElement" @select="copyOuterHTML"
              >outerHTML</ContextMenuItem
            >
            <ContextMenuItem :disabled="!isElement" @select="copyInnerHTML"
              >innerHTML</ContextMenuItem
            >
            <ContextMenuItem :disabled="!isElement" @select="copySelector"
              >selector</ContextMenuItem
            >
            <ContextMenuItem :disabled="!isElement" @select="copyXPath">XPath</ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuItem :disabled="!isElement" @select="duplicateNode">
          Duplicate element
        </ContextMenuItem>
        <ContextMenuItem :disabled="!isElement" @select="hideElement">Hide element</ContextMenuItem>
        <ContextMenuItem :disabled="!isElement" @select="scrollIntoView">
          Scroll into view
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem :disabled="!hasChildren" @select="expandRecursively">
          Expand recursively
        </ContextMenuItem>
        <ContextMenuItem :disabled="!hasChildren" @select="collapseAll">
          Collapse children
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem class="text-red-400 focus:text-red-300" @select="deleteNode">
          Delete element
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>

    <template v-if="isExpanded && visibleChildren.length > 0">
      <DomTreeNode
        v-for="child in visibleChildren"
        :key="child.nodeId"
        :node="child"
        :depth="depth + 1"
        @select="emit('select', $event)"
        @expand="emit('expand', $event)"
        @hover="emit('hover', $event)"
        @unhover="emit('unhover')"
        @edit-as-html="emit('editAsHtml', $event)"
      />
      <div
        class="text-xs font-mono text-purple-400 h-6 flex items-center"
        :style="{ paddingLeft: `${depth * 16 + 24}px` }"
      >
        &lt;/{{ node.localName }}&gt;
      </div>
    </template>
  </div>
</template>
