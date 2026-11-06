<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import { useResizeObserver } from "@vueuse/core";
import { toast } from "vue-sonner";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import KeyCaps from "@/components/command/KeyCaps.vue";
import { bindingTokens } from "@/lib/commands/keymap";
import SqliteTabItem from "./SqliteTabItem.vue";
import SqliteTabOverflow from "./SqliteTabOverflow.vue";
import type { SqliteStripTab } from "./sqliteStripTabs";

/**
 * The open database's tabs (`role="tablist"`): the fixed Overview, then tables, SQL and Diagram.
 * ←/→ move between tabs, Enter or Space shows one, Delete closes it, Shift+F10 opens its menu
 * (keep, close, close others, to the right, all, reopen, copy the name). Past the strip's width
 * it scrolls, keeps the active tab in view, and "N more" lists every tab. The database's own
 * facts and actions sit at the right end (`end` slot), as they apply to every tab.
 */
const props = defineProps<{
  tabs: readonly SqliteStripTab[];
  databaseName: string;
  canReopen: boolean;
  panelId: string;
}>();

const emit = defineEmits<{
  select: [id: string];
  close: [id: string];
  keep: [id: string];
  closeOthers: [id: string];
  closeToRight: [id: string];
  closeAll: [];
  reopen: [];
}>();

defineSlots<{ end?: () => unknown }>();

const scroller = ref<HTMLElement | null>(null);
const overflowing = ref(false);
const hidden = ref(0);

function measure() {
  const element = scroller.value;
  if (!element) return;
  overflowing.value = element.scrollWidth > element.clientWidth + 1;
  if (!overflowing.value) {
    hidden.value = 0;
    return;
  }
  const box = element.getBoundingClientRect();
  hidden.value = [...element.querySelectorAll<HTMLElement>("[data-tab-id]")].filter((tab) => {
    const rect = tab.getBoundingClientRect();
    return rect.right > box.right + 1 || rect.left < box.left - 1;
  }).length;
}

useResizeObserver(scroller, measure);

function reveal(id: string | undefined) {
  if (!id) return;
  void nextTick(() => {
    scroller.value
      ?.querySelector<HTMLElement>(`[data-tab-id="${CSS.escape(id)}"]`)
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
    measure();
  });
}

watch(
  () => [props.tabs.find((tab) => tab.active)?.id, props.tabs.length] as const,
  ([id]) => reveal(id),
  { immediate: true },
);

function focusTab(id: string | undefined) {
  if (!id) return;
  scroller.value?.querySelector<HTMLElement>(`[data-tab-id="${CSS.escape(id)}"]`)?.focus();
}

function onKeydown(event: KeyboardEvent) {
  const target = event.target instanceof HTMLElement ? event.target.closest("[data-tab-id]") : null;
  const id = target?.getAttribute("data-tab-id") ?? undefined;
  const at = props.tabs.findIndex((tab) => tab.id === id);
  if (at < 0) return;
  const tab = props.tabs[at];
  if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
    event.preventDefault();
    const step = event.key === "ArrowRight" ? 1 : -1;
    focusTab(props.tabs[(at + step + props.tabs.length) % props.tabs.length]?.id);
  } else if (event.key === "Home" || event.key === "End") {
    event.preventDefault();
    focusTab(props.tabs[event.key === "Home" ? 0 : props.tabs.length - 1]?.id);
  } else if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    if (tab) emit("select", tab.id);
  } else if (event.key === "Delete" && tab?.closable) {
    event.preventDefault();
    emit("close", tab.id);
  }
}

async function copyName(label: string) {
  try {
    await navigator.clipboard.writeText(label);
    toast.success(`Copied ${label}`);
  } catch (error) {
    toast.error("Could not copy", { description: String(error) });
  }
}
</script>

<template>
  <div class="flex h-10 shrink-0 items-center gap-1 border-b border-cladd-outline pr-1.5 pl-1">
    <div
      ref="scroller"
      role="tablist"
      :aria-label="`Tabs of ${databaseName}`"
      class="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto overflow-y-hidden py-1 [scrollbar-width:none]"
      @keydown="onKeydown"
      @scroll.passive="measure"
    >
      <ContextMenu v-for="tab in tabs" :key="tab.id">
        <ContextMenuTrigger as-child :disabled="!tab.closable">
          <span class="contents">
            <SqliteTabItem
              :id="tab.id"
              :label="tab.label"
              :icon="tab.icon"
              :active="tab.active"
              :preview="tab.preview"
              :staged="tab.staged"
              :closable="tab.closable"
              :icon-only="!tab.closable"
              :controls="panelId"
              @select="emit('select', tab.id)"
              @keep="emit('keep', tab.id)"
              @close="emit('close', tab.id)"
            />
          </span>
        </ContextMenuTrigger>
        <ContextMenuContent class="w-56">
          <ContextMenuItem v-if="tab.preview" @select="emit('keep', tab.id)">
            Keep open
          </ContextMenuItem>
          <ContextMenuItem @select="emit('close', tab.id)">
            Close
            <ContextMenuShortcut
              ><KeyCaps :keys="bindingTokens('mod+w')" quiet
            /></ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem @select="emit('closeOthers', tab.id)">Close the others</ContextMenuItem>
          <ContextMenuItem @select="emit('closeToRight', tab.id)">
            Close the tabs to the right
          </ContextMenuItem>
          <ContextMenuItem @select="emit('closeAll')">Close every tab</ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem :disabled="!canReopen" @select="emit('reopen')">
            Reopen the closed tab
            <ContextMenuShortcut>
              <KeyCaps :keys="bindingTokens('mod+shift+t')" quiet />
            </ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem @select="copyName(tab.label)">Copy the name</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </div>
    <SqliteTabOverflow
      v-if="overflowing"
      :tabs="tabs"
      :hidden="hidden"
      @select="emit('select', $event)"
      @close="emit('close', $event)"
    />
    <slot name="end" />
  </div>
</template>
