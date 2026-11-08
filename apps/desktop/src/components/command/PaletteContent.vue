<script setup lang="ts">
import { computed, nextTick, onMounted, ref, useId, watch } from "vue";
import { Search } from "lucide-vue-next";
import { Button, Chip } from "@capubridge/cladd";
import { useCommandsStore } from "@/stores/commands.store";
import type { PaletteMode } from "@/lib/commands/palette/modes";
import KeyCaps from "./KeyCaps.vue";
import PaletteList from "./PaletteList.vue";
import { usePalette } from "./usePalette";

/**
 * Everything inside the palette dialog. It exists only while the palette is open, so its state
 * starts fresh from the query the palette was opened with and the installed-apps query lives
 * only as long as the palette does.
 */
const commands = useCommandsStore();
const palette = usePalette(commands.paletteQuery);
const listId = useId();

const MODE_HINTS: Array<{ mode: PaletteMode; sign: string; word: string }> = [
  { mode: "open", sign: "open", word: "apps" },
  { mode: "actions", sign: ">", word: "actions" },
  { mode: "device", sign: "@", word: "devices" },
  { mode: "table", sign: "#", word: "tables" },
  { mode: "screen", sign: ":", word: "this screen" },
];

const inputRef = ref<HTMLInputElement | null>(null);
const listRef = ref<InstanceType<typeof PaletteList> | null>(null);

const activeDescendant = computed(() => listRef.value?.optionIdOf(palette.highlighted.value));

watch(
  () => palette.navigated.value,
  async () => {
    await nextTick();
    listRef.value?.revealHighlighted();
  },
);

function focusInput() {
  const input = inputRef.value;
  if (!input) return;
  input.focus();
  const end = input.value.length;
  input.setSelectionRange(end, end);
}

onMounted(() => requestAnimationFrame(focusInput));

function onInput(event: Event) {
  if (!(event.target instanceof HTMLInputElement)) return;
  const input = event.target;
  palette.input(input.value);
  if (input.value !== palette.text.value) input.value = palette.text.value;
}

function enter(mode: PaletteMode) {
  palette.enterMode(mode);
  void nextTick(focusInput);
}

function onKeydown(event: KeyboardEvent) {
  if (event.isComposing) return;
  switch (event.key) {
    case "ArrowDown":
      event.preventDefault();
      palette.move(1);
      break;
    case "ArrowUp":
      event.preventDefault();
      palette.move(-1);
      break;
    case "PageDown":
      event.preventDefault();
      palette.move(palette.pageStep);
      break;
    case "PageUp":
      event.preventDefault();
      palette.move(-palette.pageStep);
      break;
    case "Enter":
      event.preventDefault();
      palette.chooseHighlighted();
      break;
    case "Tab":
      event.preventDefault();
      break;
    case "Backspace":
      if (inputRef.value?.value === "" && palette.back()) event.preventDefault();
      break;
  }
}
</script>

<template>
  <div class="flex min-h-0 flex-col">
    <div class="flex h-13 items-center gap-3 px-4">
      <Search :size="16" :stroke-width="1.8" class="shrink-0 text-muted-foreground" />
      <Chip v-if="palette.mode.value !== 'all'" size="sm" rounded class="shrink-0">
        {{ palette.modeMeta.value.label }}
      </Chip>
      <input
        ref="inputRef"
        :value="palette.text.value"
        data-palette-input
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded="true"
        :aria-controls="listId"
        :aria-activedescendant="activeDescendant"
        :aria-label="palette.modeMeta.value.label || 'Search'"
        autocomplete="off"
        spellcheck="false"
        :placeholder="palette.modeMeta.value.placeholder"
        class="h-full min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-[var(--fg-subtle)]"
        @input="onInput"
        @keydown="onKeydown"
      />
      <KeyCaps keys="esc" />
    </div>

    <div class="h-px bg-border-subtle" />

    <PaletteList
      v-if="palette.rows.value.length > 0"
      ref="listRef"
      :rows="palette.rows.value"
      :highlighted="palette.highlighted.value"
      :list-id="listId"
      @hover="palette.hover"
      @choose="palette.chooseKey"
    />
    <div v-else class="flex flex-col items-center gap-1 px-4 py-12 text-center">
      <p class="text-sm text-foreground">
        <template v-if="palette.text.value">Nothing matches “{{ palette.text.value }}”</template>
        <template v-else>{{ palette.modeMeta.value.empty }}</template>
      </p>
      <p v-if="palette.text.value" class="text-xs text-muted-foreground">
        {{ palette.modeMeta.value.empty }}
      </p>
    </div>

    <div
      class="flex h-9 items-center gap-3 border-t border-border-subtle bg-surface-1 px-3 text-2xs whitespace-nowrap text-muted-foreground"
    >
      <span class="flex items-center gap-1.5"><KeyCaps keys="up down" /> move</span>
      <span class="flex items-center gap-1.5"><KeyCaps keys="enter" /> run</span>
      <span class="flex-1" />
      <Button
        v-for="hint in MODE_HINTS"
        :key="hint.mode"
        size="xs"
        variant="transparent"
        :outline="false"
        tabindex="-1"
        :aria-label="`Search ${hint.word}`"
        :aria-pressed="palette.mode.value === hint.mode"
        content-class-name="gap-1.5 px-1.5 text-2xs font-normal text-muted-foreground"
        @click="enter(hint.mode)"
      >
        <span class="font-mono text-foreground">{{ hint.sign }}</span> {{ hint.word }}
      </Button>
    </div>
  </div>
</template>
