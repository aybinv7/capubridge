<script setup lang="ts">
import { ListButton, StatusDot } from "@capubridge/cladd";
import DeviceKindIcon from "./DeviceKindIcon.vue";

const props = defineProps<{ name: string; viewed: boolean }>();

const emit = defineEmits<{ select: [] }>();
</script>

<template>
  <ListButton
    size="md"
    :selected="props.viewed"
    data-roving-item
    :data-current="props.viewed || undefined"
    tight-focus-ring
    class="w-full"
    content-class-name="gap-2.5 px-2.5 py-1.5"
    icon-class-name="text-muted-foreground"
    @click="emit('select')"
  >
    <template #icon>
      <DeviceKindIcon local />
    </template>
    <span class="truncate text-sm font-medium text-foreground">{{ props.name }}</span>
    <template #footer>
      <span class="flex items-center gap-1.5 text-2xs font-normal">
        <StatusDot color="green" size="xs" />
        <span class="text-muted-foreground">Local pages in a native WebView</span>
      </span>
    </template>
  </ListButton>
</template>
