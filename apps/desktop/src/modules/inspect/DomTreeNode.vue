<script setup lang="ts">
import { computed } from "vue";
import { ChevronRight } from "lucide-vue-next";
import type { DOMNode, DOMAttribute } from "@/types/inspect.types";
import { useInspectStore } from "@/stores/inspect.store";

const props = defineProps<{
  node: DOMNode;
  depth: number;
}>();

const emit = defineEmits<{
  select: [nodeId: number];
  expand: [nodeId: number];
  hover: [nodeId: number];
  unhover: [];
}>();

const store = useInspectStore();

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

const isElement = computed(() => props.node.nodeType === 1);
const isText = computed(() => props.node.nodeType === 3);
</script>

<template>
  <div>
    <div
      class="flex items-center gap-0 pr-2 h-6 cursor-pointer group transition-colors"
      :class="{
        'bg-blue-500/15 text-blue-300': isSelected,
        'hover:bg-surface-2': !isSelected,
      }"
      :style="{ paddingLeft: `${depth * 16 + 4}px` }"
      @click="emit('select', node.nodeId)"
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
          <span class="text-purple-400">&lt;{{ node.localName }}</span>
          <template v-for="attr in attributes" :key="attr.name">
            <span class="text-yellow-400/70"> {{ attr.name }}</span>
            <span v-if="attr.value" class="text-muted-foreground">=</span>
            <span v-if="attr.value" class="text-green-400/70">"{{ attr.value }}"</span>
          </template>
          <span class="text-purple-400">&gt;</span>
          <span v-if="inlineText" class="text-foreground/70">{{ inlineText }}</span>
          <span v-if="inlineText" class="text-purple-400">&lt;/{{ node.localName }}&gt;</span>
        </span>
      </template>

      <template v-if="isText">
        <span class="text-xs font-mono text-foreground/60 truncate">
          "{{ node.nodeValue.trim() }}"
        </span>
      </template>
    </div>

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
