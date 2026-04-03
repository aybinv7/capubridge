<script setup lang="ts">
import { computed } from "vue";
import { ChevronDown, Loader2, CircleDot } from "lucide-vue-next";
import { useCDP } from "@/composables/useCDP";
import type { CDPTarget } from "@/types/cdp.types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const { devicesStore, targetsStore, connectionStore, forwardAndFetchTargets, connectToTarget } =
  useCDP();

import { watch } from "vue";
watch(
  () => devicesStore.selectedDevice,
  async (device) => {
    targetsStore.clearTargets();
    if (device?.status === "online") {
      await forwardAndFetchTargets(device.serial);
    }
  },
);

async function handleTargetSelect(target: CDPTarget) {
  targetsStore.selectTarget(target);
  try {
    await connectToTarget(target);
  } catch (err) {
    console.error("CDP connect failed:", err);
  }
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
</script>

<template>
  <!-- No device selected -->
  <span v-if="!devicesStore.selectedDevice" class="text-[11px] text-muted-foreground/40 px-1">
    No device selected
  </span>

  <!-- Fetching targets -->
  <span
    v-else-if="targetsStore.isFetching"
    class="flex items-center gap-1.5 text-[11px] text-muted-foreground/60 px-1"
  >
    <Loader2 :size="11" class="animate-spin" />
    Fetching targets…
  </span>

  <!-- No targets -->
  <span
    v-else-if="targetsStore.targets.length === 0"
    class="text-[11px] text-muted-foreground/40 px-1"
  >
    No inspectable targets
  </span>

  <!-- Target picker dropdown -->
  <DropdownMenu v-else>
    <DropdownMenuTrigger as-child>
      <button
        class="flex h-6 min-w-[160px] max-w-[280px] items-center gap-1.5 border border-border bg-transparent px-2 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <!-- Connection dot -->
        <span class="size-[6px] rounded-full shrink-0" :class="dotClass" />
        <!-- Target title -->
        <span class="flex-1 truncate text-left">
          {{ targetsStore.selectedTarget?.title || "Pick a target" }}
        </span>
        <ChevronDown :size="10" class="shrink-0 opacity-50" />
      </button>
    </DropdownMenuTrigger>

    <DropdownMenuContent align="end" class="w-80">
      <DropdownMenuLabel
        class="py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60"
      >
        Inspectable Targets
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        v-for="target in targetsStore.targets"
        :key="target.id"
        class="flex flex-col items-start gap-0.5 py-1.5 cursor-pointer"
        @click="handleTargetSelect(target)"
      >
        <div class="flex w-full items-center gap-1.5">
          <span
            class="size-[6px] rounded-full shrink-0"
            :class="
              connStatus(target.id) === 'connected' ? 'bg-status-success' : 'bg-muted-foreground/20'
            "
          />
          <span class="flex-1 truncate text-xs">
            {{ target.title || "(no title)" }}
          </span>
          <CircleDot
            v-if="targetsStore.selectedTarget?.id === target.id"
            :size="10"
            class="text-primary shrink-0"
          />
        </div>
        <span class="pl-[14px] w-full truncate font-mono text-[10px] text-muted-foreground/50">
          {{ target.url }}
        </span>
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
