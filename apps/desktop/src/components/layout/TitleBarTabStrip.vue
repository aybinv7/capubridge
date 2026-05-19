<script setup lang="ts">
import { ref } from "vue";
import { X, Plus } from "lucide-vue-next";
import { useTabsStore } from "@/stores/tabs.store";
import type { Tab } from "@/types/tabs.types";

const tabsStore = useTabsStore();

const dragFromIndex = ref<number | null>(null);

function onTabClick(id: string) {
  tabsStore.focusTab(id);
}

function onMiddleClick(e: MouseEvent, id: string) {
  if (e.button === 1) {
    e.preventDefault();
    tabsStore.closeTab(id);
  }
}

function onCloseClick(e: MouseEvent, id: string) {
  e.stopPropagation();
  tabsStore.closeTab(id);
}

function onDragStart(e: DragEvent, index: number) {
  dragFromIndex.value = index;
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
  }
}

function onDragOver(e: DragEvent) {
  if (dragFromIndex.value === null) return;
  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
}

function onDrop(e: DragEvent, toIndex: number) {
  e.preventDefault();
  if (dragFromIndex.value === null) return;
  const tab = tabsStore.tabs[dragFromIndex.value];
  if (tab) tabsStore.moveTab(tab.id, toIndex);
  dragFromIndex.value = null;
}

function onDragEnd() {
  dragFromIndex.value = null;
}

function tabAria(tab: Tab) {
  return tabsStore.activeTabId === tab.id;
}
</script>

<template>
  <div class="flex h-full items-center gap-1 overflow-x-auto" role="tablist" aria-label="Open tabs">
    <button
      v-for="(tab, idx) in tabsStore.tabs"
      :key="tab.id"
      type="button"
      role="tab"
      :aria-selected="tabAria(tab)"
      :title="tab.title"
      class="group relative flex h-7 max-w-[260px] shrink-0 items-center gap-1.5 truncate rounded-md border px-2.5 text-xs transition-colors duration-150"
      :class="
        tabsStore.activeTabId === tab.id
          ? 'border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--fg-default)]'
          : 'border-transparent text-[var(--fg-muted)] hover:bg-[var(--bg-surface-raised)] hover:text-[var(--fg-default)]'
      "
      draggable="true"
      @click="onTabClick(tab.id)"
      @mousedown="onMiddleClick($event, tab.id)"
      @dragstart="onDragStart($event, idx)"
      @dragover="onDragOver"
      @drop="onDrop($event, idx)"
      @dragend="onDragEnd"
    >
      <span
        v-if="tabsStore.activeTabId === tab.id"
        class="absolute -bottom-px left-2 right-2 h-0.5 rounded-full bg-[var(--accent)]"
        aria-hidden="true"
      />
      <span class="truncate">{{ tab.title }}</span>
      <span
        class="inline-flex size-4 shrink-0 items-center justify-center rounded text-[var(--fg-subtle)] opacity-0 transition-opacity hover:bg-[var(--bg-surface-raised)] hover:text-[var(--fg-default)] group-hover:opacity-100"
        :class="tabsStore.activeTabId === tab.id ? 'opacity-100' : ''"
        role="button"
        :aria-label="`Close ${tab.title}`"
        @click="onCloseClick($event, tab.id)"
      >
        <X :size="11" />
      </span>
    </button>

    <button
      v-if="tabsStore.tabs.length > 0"
      type="button"
      class="flex size-7 shrink-0 items-center justify-center rounded-md text-[var(--fg-muted)] transition-colors hover:bg-[var(--bg-surface-raised)] hover:text-[var(--fg-default)]"
      title="New tab"
      aria-label="New tab"
    >
      <Plus :size="13" />
    </button>
  </div>
</template>
