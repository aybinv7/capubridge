<script setup lang="ts">
import { computed } from "vue";
import { ArrowUpRight, CircleStop, Eraser, Play, RotateCcw } from "lucide-vue-next";
import { Button } from "@capubridge/cladd";
import HintTooltip from "@/shared/components/presentation/HintTooltip.vue";
import { openLabel } from "../lifecycle/lifecycle";
import type { AppRunState } from "../process/processPhase";

const props = defineProps<{ busy: boolean; runState: AppRunState }>();

const emit = defineEmits<{ open: []; restart: []; forceStop: []; clearData: [] }>();

const inBackground = computed(() => props.runState === "background");
const opens = computed(() => props.runState === "stopped" || inBackground.value);
const openHint = computed(() =>
  props.runState === "running" ? "The app is already on the phone's screen" : null,
);
</script>

<template>
  <div class="flex flex-wrap items-center gap-1.5" role="group" aria-label="App actions">
    <HintTooltip :text="openHint">
      <Button
        size="sm"
        :variant="opens ? 'solid-fill' : 'transparent'"
        :disabled="props.busy"
        :content-class-name="`gap-1.5 [&>svg]:size-3.5 ${opens ? 'px-3' : 'px-2.5'}`"
        @click="emit('open')"
      >
        <ArrowUpRight v-if="inBackground" :stroke-width="1.8" />
        <Play v-else :stroke-width="1.8" />
        {{ openLabel(inBackground) }}
      </Button>
    </HintTooltip>
    <HintTooltip text="Stops the app and opens it again from scratch">
      <Button
        size="sm"
        variant="transparent"
        :disabled="props.busy"
        content-class-name="gap-1.5 px-2.5 [&>svg]:size-3.5"
        @click="emit('restart')"
      >
        <RotateCcw :stroke-width="1.8" />
        Restart
      </Button>
    </HintTooltip>
    <Button
      size="sm"
      variant="transparent"
      :disabled="props.busy"
      content-class-name="gap-1.5 px-2.5 [&>svg]:size-3.5"
      @click="emit('forceStop')"
    >
      <CircleStop :stroke-width="1.8" />
      Force stop
    </Button>
    <Button
      size="sm"
      variant="transparent"
      :disabled="props.busy"
      content-class-name="gap-1.5 px-2.5 [&>svg]:size-3.5"
      @click="emit('clearData')"
    >
      <Eraser :stroke-width="1.8" />
      Clear data
    </Button>
  </div>
</template>
