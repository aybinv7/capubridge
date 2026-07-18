<script setup lang="ts">
import { ref, computed, watch, nextTick } from "vue";
import type { Component } from "vue";
import { useRouter } from "vue-router";
import { Search, Terminal } from "lucide-vue-next";
import { commandPaletteFeatures } from "@/app/feature-registry";
import { useDockStore } from "@/stores/dock.store";
import type { FeatureMaturity } from "@/app/feature-registry";

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();

const router = useRouter();
const dockStore = useDockStore();
const query = ref("");
const selected = ref(0);
const inputRef = ref<HTMLInputElement>();
const listRef = ref<HTMLDivElement>();

interface PaletteCommand {
  group: string;
  icon: Component;
  label: string;
  action: () => void | Promise<unknown>;
  keys: string;
  maturity?: FeatureMaturity;
}

const commands: PaletteCommand[] = [
  ...commandPaletteFeatures.map((feature) => ({
    group: "Navigate",
    icon: feature.icon,
    label: feature.label,
    action: () => router.push(feature.path),
    keys: "",
    maturity: feature.maturity,
  })),
  {
    group: "Dock",
    icon: Terminal,
    label: "Dock Console",
    action: () => dockStore.openDock("console"),
    keys: "Ctrl+J",
  },
];

const filtered = computed(() => {
  if (!query.value) return commands;
  const q = query.value.toLowerCase();
  return commands.filter(
    (c) => c.label.toLowerCase().includes(q) || c.group.toLowerCase().includes(q),
  );
});

const grouped = computed(() => {
  const map = new Map<string, typeof commands>();
  for (const cmd of filtered.value) {
    const group = map.get(cmd.group);
    if (group) {
      group.push(cmd);
    } else {
      map.set(cmd.group, [cmd]);
    }
  }
  return map;
});

const flatFiltered = computed(() => filtered.value);

function globalIndex(group: string, localIdx: number): number {
  let offset = 0;
  for (const [g, cmds] of grouped.value) {
    if (g === group) return offset + localIdx;
    offset += cmds.length;
  }
  return 0;
}

function scrollToSelected() {
  nextTick(() => {
    const el = listRef.value?.querySelector('[data-selected="true"]');
    if (el) {
      el.scrollIntoView({ block: "nearest" });
    }
  });
}

watch(
  () => filtered.value,
  () => {
    selected.value = 0;
  },
);

watch(selected, () => {
  scrollToSelected();
});

function run(idx: number) {
  const cmd = flatFiltered.value[idx];
  if (cmd) {
    cmd.action();
    emit("close");
  }
}

function onKey(e: KeyboardEvent) {
  if (e.key === "ArrowDown") {
    e.preventDefault();
    selected.value = Math.min(selected.value + 1, flatFiltered.value.length - 1);
  }
  if (e.key === "ArrowUp") {
    e.preventDefault();
    selected.value = Math.max(selected.value - 1, 0);
  }
  if (e.key === "Enter") {
    e.preventDefault();
    run(selected.value);
  }
  if (e.key === "Escape") {
    emit("close");
  }
}

watch(
  () => props.open,
  async (val) => {
    if (val) {
      query.value = "";
      selected.value = 0;
      await nextTick();
      inputRef.value?.focus();
    }
  },
);
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-all duration-200 ease-out"
      enter-from-class="opacity-0 scale-[0.98]"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition-all duration-100 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-[0.98]"
    >
      <div v-if="open" class="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="emit('close')" />

        <div
          class="relative w-[560px] bg-surface-1 border border-border/30 rounded-xl overflow-hidden shadow-2xl"
        >
          <!-- Input -->
          <div class="flex items-center gap-3 px-5 py-4 border-b border-border/30">
            <Search class="w-4 h-4 text-muted-foreground/60 shrink-0" />
            <input
              ref="inputRef"
              v-model="query"
              @keydown="onKey"
              class="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/50"
              placeholder="Type a command or search…"
            />
            <kbd
              class="text-[10px] text-muted-foreground/60 bg-surface-2 px-2 py-0.5 border border-border/30 rounded-md font-mono"
              >esc</kbd
            >
          </div>

          <!-- Results -->
          <div ref="listRef" class="max-h-[360px] overflow-y-auto py-1">
            <template v-for="[group, cmds] in grouped" :key="group">
              <div
                class="px-5 py-2 text-[10px] text-muted-foreground/60 uppercase tracking-wider font-semibold"
              >
                {{ group }}
              </div>
              <button
                v-for="(cmd, i) in cmds"
                :key="cmd.label"
                @click="run(globalIndex(group, i))"
                @mouseenter="selected = globalIndex(group, i)"
                :data-selected="selected === globalIndex(group, i)"
                class="w-full flex items-center gap-3 px-5 py-2.5 text-sm transition-colors duration-100"
                :class="
                  selected === globalIndex(group, i)
                    ? 'bg-surface-2 text-foreground'
                    : 'text-muted-foreground/80 hover:bg-surface-2/50 hover:text-foreground'
                "
              >
                <component :is="cmd.icon" class="w-4 h-4 shrink-0 opacity-70" />
                <span class="flex-1 text-left text-sm">{{ cmd.label }}</span>
                <span
                  v-if="cmd.maturity && cmd.maturity !== 'stable'"
                  class="rounded-full border border-border/40 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground/65"
                >
                  {{ cmd.maturity }}
                </span>
                <span
                  v-if="cmd.keys"
                  class="text-[10px] font-mono text-muted-foreground/60 bg-surface-2 px-2 py-0.5 border border-border/30 rounded-md"
                  >{{ cmd.keys }}</span
                >
              </button>
            </template>

            <div v-if="flatFiltered.length === 0" class="py-10 text-center">
              <p class="text-sm text-muted-foreground/50">No commands found</p>
              <p class="text-xs text-muted-foreground/40 mt-1">Try a different search term</p>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
