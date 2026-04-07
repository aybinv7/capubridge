<script setup lang="ts">
import { computed, ref } from "vue";
import { ChevronDown, Loader2, Smartphone, Globe, RefreshCw } from "lucide-vue-next";
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

const { targetsStore, connectionStore, connectToTarget, sourceStore, refreshTargets } = useCDP();

async function handleTargetSelect(target: CDPTarget) {
  targetsStore.selectTarget(target);
  try {
    await connectToTarget(target);
  } catch (err) {
    console.error("CDP connect failed:", err);
  }
}

async function openTarget() {
  if (isOpen.value) return (isOpen.value = false);
  refreshTargets();
  isOpen.value = true;
}

async function handleScan() {
  await refreshTargets();
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
const isFetching = computed(() => targetsStore.fetchingSources.size > 0);
const hasTargets = computed(() => targetsStore.targets.length > 0);

const sourceIcon = (source: string) => {
  return source === "adb" ? Smartphone : Globe;
};
</script>

<template>
  <!-- No source connected yet — show nothing, the source selector handles this -->
  <template v-if="!hasActiveSource" />

  <!-- Source active, scanning in progress -->
  <div
    v-else-if="isFetching && !hasTargets"
    class="flex h-6 items-center gap-1.5 px-2 text-[11px] text-muted-foreground/50"
  >
    <Loader2 :size="11" class="animate-spin" />
    <span>Scanning…</span>
  </div>

  <!-- Source active, no targets found — show scannable button -->
  <button
    v-else-if="!hasTargets"
    class="flex h-6 items-center gap-1.5 px-2.5 rounded-xl border border-dashed border-border/40 text-[11px] text-muted-foreground/50 hover:text-foreground hover:border-border/60 hover:bg-surface-2/50 transition-colors"
    @click="handleScan"
  >
    <RefreshCw :size="10" :class="isFetching ? 'animate-spin' : ''" />
    <span>No targets — scan</span>
  </button>

  <!-- Has targets — show dropdown -->
  <DropdownMenu :open="isOpen" v-else @update:open="openTarget()">
    <DropdownMenuTrigger as-child>
      <button
        class="flex h-6 rounded-xl min-w-40 max-w-70 items-center gap-2 pr-2 border border-border/40 bg-surface-2/50 text-[11px] text-foreground/70 transition-colors hover:bg-surface-3 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <span class="size-1.5 rounded-full shrink-0 ml-2" :class="dotClass" />
        <span class="flex-1 truncate text-left">
          {{ targetsStore.selectedTarget?.title || "Pick a target" }}
        </span>
        <ChevronDown :size="10" class="shrink-0 opacity-50" />
      </button>
    </DropdownMenuTrigger>

    <DropdownMenuContent align="end" class="w-80 p-1">
      <div class="flex items-center justify-between px-2 py-2">
        <span class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Targets
        </span>
        <button
          class="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground hover:bg-surface-3 transition-colors"
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
            class="size-1.5 rounded-full shrink-0"
            :class="
              connStatus(target.id) === 'connected' ? 'bg-status-success' : 'bg-muted-foreground/20'
            "
          />
          <component
            :is="sourceIcon(target.source)"
            :size="12"
            class="text-muted-foreground/40 shrink-0"
          />
          <span class="flex-1 truncate text-xs text-foreground">
            {{ target.title || "(no title)" }}
          </span>
        </div>
        <span class="w-full truncate font-mono text-[10px] text-foreground pl-4">
          {{ target.url }}
        </span>
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
