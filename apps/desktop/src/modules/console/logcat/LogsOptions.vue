<script setup lang="ts">
import { computed, ref } from "vue";
import { SlidersHorizontal } from "lucide-vue-next";
import { Checkbox, Popover, Switch } from "@capubridge/cladd";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import { useLogcatStore } from "@/stores/logcat.store";
import { useLogsPrefs } from "./logsPrefs";

const BUFFERS = [
  { id: "main", label: "Main", hint: "Apps and most of the system" },
  { id: "system", label: "System", hint: "Android system services" },
  { id: "crash", label: "Crash", hint: "Crash reports" },
  { id: "events", label: "Events", hint: "Binary system events" },
  { id: "radio", label: "Radio", hint: "Telephony and radio" },
  { id: "kernel", label: "Kernel", hint: "The kernel log, where the device allows it" },
] as const;
const DEFAULT_BUFFERS = ["main", "system", "crash"];

/**
 * The Logs options: which logcat buffers to read (the capture restarts to apply it), whether to
 * hide WebView console echoes, and whether to show the process column.
 */
const logcat = useLogcatStore();
const prefs = useLogsPrefs();
const open = ref(false);
const anchor = ref<HTMLElement | null>(null);

const chosen = computed<readonly string[]>(() => {
  const buffers = logcat.buffers;
  return !buffers || buffers.includes("default") ? DEFAULT_BUFFERS : buffers;
});

function toggleBuffer(id: string, on: boolean) {
  const next = on
    ? [...new Set([...chosen.value, id])]
    : chosen.value.filter((item) => item !== id);
  if (next.length === 0) return;
  const isDefault =
    next.length === DEFAULT_BUFFERS.length && DEFAULT_BUFFERS.every((item) => next.includes(item));
  void logcat.setBuffers(isDefault ? null : next);
}
</script>

<template>
  <span ref="anchor" class="inline-flex">
    <IconAction
      label="Log options"
      hint="Buffers, WebView echoes, process column"
      :pressed="open"
      :aria-expanded="open"
      @click="open = !open"
    >
      <SlidersHorizontal :stroke-width="1.8" />
    </IconAction>
  </span>
  <Popover
    v-model:open="open"
    :anchor-element="anchor ?? undefined"
    position="bottom-end"
    :offset="6"
    class="w-72"
    content-class-name="w-full p-3"
    aria-label="Log options"
  >
    <div class="flex flex-col gap-3">
      <fieldset class="flex flex-col gap-1.5">
        <legend class="mb-1 text-xs font-medium text-foreground">Buffers to read</legend>
        <label
          v-for="buffer in BUFFERS"
          :key="buffer.id"
          class="flex items-center gap-2 text-xs text-foreground"
        >
          <Checkbox
            size="sm"
            :checked="chosen.includes(buffer.id)"
            :disabled="chosen.length === 1 && chosen.includes(buffer.id)"
            @update:checked="toggleBuffer(buffer.id, $event)"
          />
          <span>{{ buffer.label }}</span>
          <span class="truncate text-2xs text-[var(--fg-subtle)]">{{ buffer.hint }}</span>
        </label>
        <p class="text-2xs text-[var(--fg-subtle)]">Changing buffers starts the capture again.</p>
      </fieldset>
      <label class="flex items-start justify-between gap-3 text-xs text-foreground">
        <span class="flex flex-col gap-0.5">
          <span>Hide WebView console echoes</span>
          <span class="text-2xs text-[var(--fg-subtle)]">Console already shows them</span>
        </span>
        <Switch v-model:checked="prefs.hideEchoes.value" size="sm" />
      </label>
      <label class="flex items-start justify-between gap-3 text-xs text-foreground">
        <span class="flex flex-col gap-0.5">
          <span>Show the process column</span>
          <span class="text-2xs text-[var(--fg-subtle)]">Process id and app on every line</span>
        </span>
        <Switch v-model:checked="prefs.processColumn.value" size="sm" />
      </label>
    </div>
  </Popover>
</template>
