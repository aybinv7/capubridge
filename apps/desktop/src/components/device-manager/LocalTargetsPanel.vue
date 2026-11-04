<script setup lang="ts">
import { ref } from "vue";
import { Button, Input } from "@capubridge/cladd";
import type { CDPTarget } from "@/types/cdp.types";
import type { LinkPresentation } from "@/lib/gates/link";
import DeviceKindIcon from "./DeviceKindIcon.vue";
import TargetRow from "./TargetRow.vue";

const props = defineProps<{
  deviceName: string;
  targets: CDPTarget[];
  selectedTargetId: string | null;
  link: LinkPresentation;
  creating: boolean;
}>();

const emit = defineEmits<{
  create: [url: string];
  select: [target: CDPTarget];
  inspect: [target: CDPTarget];
  remove: [target: CDPTarget];
}>();

const url = ref("http://localhost:5173");
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <header class="flex items-start gap-3 px-5 pt-5 pb-4">
      <div
        class="flex size-9 shrink-0 items-center justify-center rounded-control bg-surface-2 text-muted-foreground shadow-bevel"
      >
        <DeviceKindIcon local :size="17" />
      </div>
      <div class="flex min-w-0 flex-col gap-1">
        <h2 class="truncate text-base font-medium text-foreground">{{ props.deviceName }}</h2>
        <p class="text-2xs text-[var(--fg-subtle)]">
          Opens a page in a native WebView on this computer, with full DevTools.
        </p>
      </div>
    </header>

    <form class="flex gap-2 px-5 pb-4" @submit.prevent="emit('create', url)">
      <Input
        v-model="url"
        class="min-w-0 flex-1"
        placeholder="http://localhost:5173"
        aria-label="Page URL"
        input-class-name="font-mono"
      />
      <Button
        type="submit"
        variant="solid-fill"
        :loading="props.creating"
        content-class-name="px-3.5"
      >
        Open
      </Button>
    </form>

    <div class="flex h-8 shrink-0 items-center px-5">
      <span class="text-xs text-muted-foreground">Pages</span>
    </div>

    <div
      v-if="props.targets.length"
      class="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-4"
      data-target-list
    >
      <TargetRow
        v-for="target in props.targets"
        :key="target.id"
        :target="target"
        :active="target.id === props.selectedTargetId"
        :link="target.id === props.selectedTargetId ? props.link : null"
        removable
        @select="emit('select', target)"
        @inspect="emit('inspect', target)"
        @remove="emit('remove', target)"
      />
    </div>
    <p v-else class="px-5 text-xs text-[var(--fg-subtle)]">
      No local pages yet. Enter a URL above to open one.
    </p>
  </div>
</template>
