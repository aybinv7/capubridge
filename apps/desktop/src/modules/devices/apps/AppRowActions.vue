<script setup lang="ts">
import { CircleStop, Eraser, Play, Trash2 } from "lucide-vue-next";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import type { AppAction } from "./appsModel";

const props = defineProps<{ busy: boolean }>();

const emit = defineEmits<{ launch: []; action: [action: AppAction] }>();
</script>

<template>
  <span class="flex items-center gap-0.5" @click.stop @dblclick.stop>
    <IconAction label="Open on the phone" size="sm" @click="emit('launch')">
      <Play :stroke-width="1.8" />
    </IconAction>
    <IconAction
      label="Force stop"
      size="sm"
      :disabled="props.busy"
      @click="emit('action', 'forceStop')"
    >
      <CircleStop :stroke-width="1.8" />
    </IconAction>
    <IconAction
      label="Clear data"
      size="sm"
      :disabled="props.busy"
      @click="emit('action', 'clearData')"
    >
      <Eraser :stroke-width="1.8" />
    </IconAction>
    <IconAction
      label="Uninstall"
      size="sm"
      :disabled="props.busy"
      @click="emit('action', 'uninstall')"
    >
      <Trash2 :stroke-width="1.8" />
    </IconAction>
  </span>
</template>
