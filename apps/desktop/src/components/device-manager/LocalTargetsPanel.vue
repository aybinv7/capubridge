<script setup lang="ts">
import { computed, ref } from "vue";
import { useNow } from "@vueuse/core";
import { useLocalPageHistoryStore } from "@/stores/localPageHistory.store";
import LocalPageHistoryRow from "./LocalPageHistoryRow.vue";
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

const pageHistory = useLocalPageHistoryStore();
const { iconOf: pageIconOf, forget: forgetPage } = pageHistory;
const now = useNow({ interval: 30_000 });
const url = ref(pageHistory.visits[0]?.url ?? "");
const openUrls = computed(() => new Set(props.targets.map((target) => target.url)));
const recent = computed(() => pageHistory.visits.filter((visit) => !openUrls.value.has(visit.url)));
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
        placeholder="http://localhost:3000"
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
      <span class="text-xs text-muted-foreground">Open pages</span>
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
        :icon="pageIconOf(target.url)"
        removable
        @select="emit('select', target)"
        @inspect="emit('inspect', target)"
        @remove="emit('remove', target)"
      />
    </div>
    <p v-else class="px-5 pb-2 text-xs text-[var(--fg-subtle)]">
      No page is open. Enter a URL above, or reopen one from your history.
    </p>

    <template v-if="recent.length">
      <div class="flex h-8 shrink-0 items-center px-5 pt-2">
        <span class="text-xs text-muted-foreground">Recent</span>
      </div>
      <div class="flex min-h-0 flex-col gap-0.5 overflow-y-auto px-3 pb-4">
        <LocalPageHistoryRow
          v-for="visit in recent"
          :key="visit.url"
          :visit="visit"
          :now="now.getTime()"
          @open="emit('create', visit.url)"
          @forget="forgetPage(visit.url)"
        />
      </div>
    </template>
  </div>
</template>
