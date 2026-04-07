<script setup lang="ts">
import { computed, ref } from "vue";
import {
  ChevronDown,
  Loader2,
  Smartphone,
  Globe,
  RefreshCw,
} from "lucide-vue-next";
import { useCDP } from "@/composables/useCDP";
import type { CDPTarget } from "@/types/cdp.types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const isOpen = ref(false);

const {
  targetsStore,
  connectionStore,
  connectToTarget,
  sourceStore,
  refreshTargets,
} = useCDP();

async function handleTargetSelect(target: CDPTarget) {
  targetsStore.selectTarget(target);
  try {
    await connectToTarget(target);
  } catch (err) {
    console.error("CDP connect failed:", err);
  }
}

function openTarget() {
  if (isOpen.value) return (isOpen.value = false);
  refreshTargets();
  isOpen.value = true;
}

function connStatus(targetId: string) {
  return connectionStore.connections.get(targetId)?.status ?? "disconnected";
}

const selectedStatus = computed(() => {
  const t = targetsStore.selectedTarget;
  if (!t) return "disconnected";
  return connStatus(t.id);
});

const dotClass = computed(() => {
  switch (selectedStatus.value) {
    case "connected":
      return "bg-status-success";
    case "connecting":
      return "bg-status-warning";
    default:
      return "bg-muted-foreground/30";
  }
});

const hasActiveSource = computed(() => sourceStore.activeSources.length > 0);
const isFetching = computed(
  () => hasActiveSource.value && targetsStore.fetchingSources.size > 0,
);
const hasTargets = computed(() => targetsStore.targets.length > 0);

const sourceIcon = (source: string) => {
  return source === "adb" ? Smartphone : Globe;
};
</script>

<template>
  <span
    v-if="!hasActiveSource"
    class="text-[11px] text-muted-foreground/40 px-1"
  >
    Select a source to inspect targets
  </span>

  <span
    v-else-if="!hasTargets"
    class="text-[11px] text-muted-foreground/40 px-1"
  >
    No inspectable targets
  </span>

  <DropdownMenu :open="isOpen" v-else @update:open="openTarget()">
    <DropdownMenuTrigger as-child>
      <button
        class="flex h-6 min-w-[160px] max-w-[280px] items-center gap-2 border border-border/40 bg-surface-2/50 px-2.5 text-[11px] text-foreground/70 transition-colors hover:bg-surface-3 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <span class="size-[6px] rounded-full shrink-0" :class="dotClass" />
        <span class="flex-1 truncate text-left">
          {{ targetsStore.selectedTarget?.title || "Pick a target" }}
        </span>
        <ChevronDown :size="10" class="shrink-0 opacity-50" />
      </button>
    </DropdownMenuTrigger>

    <DropdownMenuContent align="end" class="w-80 p-1">
      <div class="flex items-center justify-between px-2 py-2">
        <span
          class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50"
        >
          Targets
        </span>
        <button
          class="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground/50 hover:text-foreground hover:bg-surface-3 transition-colors"
          @click.stop="refreshTargets()"
        >
          <RefreshCw :size="10" :class="{ 'animate-spin': isFetching }" />
          Refresh
        </button>
      </div>
      <DropdownMenuSeparator class="-mx-1" />

      <DropdownMenuItem
        v-for="target in targetsStore.targets"
        :key="target.id"
        class="flex flex-col items-start gap-1 px-3 py-2 cursor-pointer rounded-md"
        :class="{
          'bg-surface-3/50': targetsStore.selectedTarget?.id === target.id,
        }"
        @click="handleTargetSelect(target)"
      >
        <div class="flex w-full items-center gap-2">
          <span
            class="size-[6px] rounded-full shrink-0"
            :class="
              connStatus(target.id) === 'connected'
                ? 'bg-status-success'
                : 'bg-muted-foreground/20'
            "
          />
          <component
            :is="sourceIcon(target.source)"
            :size="12"
            class="text-muted-foreground/40 shrink-0"
          />
          <span class="flex-1 truncate text-xs text-foreground/80">
            {{ target.title || "(no title)" }}
          </span>
        </div>
        <span
          class="w-full truncate font-mono text-[10px] text-muted-foreground/40 pl-[16px]"
        >
          {{ target.url }}
        </span>
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
