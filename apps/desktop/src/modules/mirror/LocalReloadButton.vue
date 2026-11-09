<script setup lang="ts">
import { RotateCw } from "lucide-vue-next";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import type { ReloadKind } from "./useLocalPageAddress";

/**
 * Reload, as in a browser: a click reloads, Shift+click reloads past the cache, and a second
 * click right after the first empties the cache and reloads hard. The first click is never
 * delayed waiting for a second one: the hard reload simply replaces it.
 */
const props = defineProps<{ loading: boolean }>();
const emit = defineEmits<{ reload: [kind: ReloadKind] }>();

const DOUBLE_CLICK_MS = 400;
let lastClickAt = 0;

function onClick(event: MouseEvent) {
  const now = event.timeStamp;
  const second = now - lastClickAt < DOUBLE_CLICK_MS;
  lastClickAt = second ? 0 : now;
  if (second) emit("reload", "empty-cache");
  else emit("reload", event.shiftKey ? "hard" : "normal");
}
</script>

<template>
  <IconAction
    label="Reload"
    hint="Shift+click reloads past the cache. Double-click empties the cache and reloads."
    size="sm"
    @click="onClick"
  >
    <RotateCw
      :stroke-width="1.8"
      :class="props.loading ? 'motion-safe:animate-spin' : ''"
      aria-hidden="true"
    />
  </IconAction>
</template>
