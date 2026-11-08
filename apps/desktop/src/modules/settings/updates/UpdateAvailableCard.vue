<script setup lang="ts">
import { Download } from "lucide-vue-next";
import { Button } from "@capubridge/cladd";
import SettingsCard from "../components/SettingsCard.vue";

const props = defineProps<{
  version: string | null;
  notes: string | null;
  downloading: boolean;
  progressPct: number | null;
  busy: boolean;
}>();

const emit = defineEmits<{ install: [] }>();
</script>

<template>
  <SettingsCard
    :title="props.version ? `Version ${props.version} is ready` : 'An update is ready'"
    padded
  >
    <div class="flex flex-col gap-3">
      <p
        v-if="props.notes"
        class="max-h-48 overflow-y-auto text-2xs leading-relaxed whitespace-pre-line text-muted-foreground select-text"
      >
        {{ props.notes }}
      </p>

      <div v-if="props.downloading" class="flex flex-col gap-1.5" role="status">
        <div
          class="h-1.5 w-full overflow-hidden rounded-full bg-surface-0"
          role="progressbar"
          :aria-valuenow="props.progressPct ?? undefined"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-label="Download progress"
        >
          <div
            class="h-full rounded-full bg-signal-select transition-[width] duration-150"
            :style="{ width: `${props.progressPct ?? 0}%` }"
          />
        </div>
        <span class="text-2xs text-muted-foreground tabular-nums">
          {{ props.progressPct !== null ? `Downloading, ${props.progressPct}%` : "Downloading…" }}
        </span>
      </div>

      <Button
        v-else
        class="self-start"
        size="sm"
        variant="solid-fill"
        color="brand"
        content-class-name="gap-1.5"
        :disabled="props.busy"
        @click="emit('install')"
      >
        <Download :size="14" aria-hidden="true" /> Install and restart
      </Button>
    </div>
  </SettingsCard>
</template>
