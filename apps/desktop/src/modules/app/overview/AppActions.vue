<script setup lang="ts">
import { ArrowUpRight, CircleStop, Eraser, Play, RotateCcw } from "lucide-vue-next";
import { Button } from "@capubridge/cladd";
import HintTooltip from "@/shared/components/presentation/HintTooltip.vue";
import { openLabel } from "../lifecycle/lifecycle";

const props = defineProps<{ busy: boolean; inBackground: boolean }>();

const emit = defineEmits<{ open: []; restart: []; forceStop: []; clearData: [] }>();
</script>

<template>
  <div class="flex flex-wrap items-center gap-1.5" role="group" aria-label="App actions">
    <Button
      size="sm"
      variant="solid-fill"
      :disabled="props.busy"
      content-class-name="gap-1.5 px-3 [&>svg]:size-3.5"
      @click="emit('open')"
    >
      <ArrowUpRight v-if="props.inBackground" :stroke-width="1.8" />
      <Play v-else :stroke-width="1.8" />
      {{ openLabel(props.inBackground) }}
    </Button>
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
