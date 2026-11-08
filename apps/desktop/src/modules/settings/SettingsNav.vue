<script setup lang="ts">
import { ListButton, StatusDot } from "@capubridge/cladd";
import { SETTINGS_SECTIONS, type SettingsSectionId } from "./settingsSections";

const props = defineProps<{
  current: SettingsSectionId | null;
  updateAvailable: boolean;
  mcpRunning: boolean;
}>();

const emit = defineEmits<{ select: [path: string] }>();
</script>

<template>
  <nav class="flex min-h-0 flex-col" aria-label="Settings sections">
    <div class="flex h-13 shrink-0 items-center px-4">
      <h2 class="text-sm font-medium text-foreground">Settings</h2>
    </div>
    <div class="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain px-2 pb-3">
      <ListButton
        v-for="section in SETTINGS_SECTIONS"
        :key="section.id"
        size="sm"
        :selected="props.current === section.id"
        :aria-current="props.current === section.id ? 'page' : undefined"
        tight-focus-ring
        class="w-full"
        content-class-name="gap-2.5 px-2.5"
        icon-class-name="text-muted-foreground"
        @click="emit('select', section.path)"
      >
        <template #icon><component :is="section.icon" :stroke-width="1.7" /></template>
        <span class="flex-1 text-left text-xs font-normal">{{ section.label }}</span>
        <StatusDot
          v-if="section.id === 'updates' && props.updateAvailable"
          color="brand"
          label="Update available"
        />
        <StatusDot
          v-else-if="section.id === 'mcp' && props.mcpRunning"
          color="green"
          label="Server running"
        />
      </ListButton>
    </div>
  </nav>
</template>
