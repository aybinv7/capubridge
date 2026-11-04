<script setup lang="ts">
import { computed, watch } from "vue";
import { BatteryCharging, RefreshCw, Wifi } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import AppBatteryTab from "./AppBatteryTab.vue";
import AppNetworkTab from "./AppNetworkTab.vue";
import { useAppPanel } from "./useAppPanel";

const panel = useAppPanel();

watch(
  () => panel.packageName.value,
  async (value) => {
    if (!value) {
      return;
    }
    await panel.inspector.fetchNetworkStats();
    await panel.inspector.fetchBatteryStats();
  },
  { immediate: true },
);

const usageState = computed(() => {
  const hasNetwork =
    !!panel.inspector.networkStats.value &&
    (panel.inspector.networkStats.value.available ||
      panel.inspector.networkStats.value.uid !== null);
  const hasBattery =
    !!panel.inspector.batteryStats.value &&
    (panel.inspector.batteryStats.value.hasData || !!panel.inspector.batteryStats.value.raw.trim());
  return {
    hasNetwork,
    hasBattery,
  };
});

async function refreshUsage() {
  panel.inspector.invalidatePackageDump();
  await Promise.all([
    panel.inspector.fetchNetworkStats({ force: true }),
    panel.inspector.fetchBatteryStats({ force: true }),
  ]);
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col overflow-hidden">
    <ScrollArea v-if="panel.selectedTarget.value && panel.packageName.value" class="h-full">
      <div class="space-y-3 p-3">
        <div
          class="flex h-10 items-center gap-3 rounded-lg border border-border/25 bg-surface-1 px-3 text-xs"
        >
          <div class="flex min-w-0 items-center gap-2">
            <Wifi class="h-3.5 w-3.5 text-info" />
            <span class="text-muted-foreground/55">Network</span>
            <span
              class="font-medium"
              :class="usageState.hasNetwork ? 'text-success' : 'text-muted-foreground/45'"
            >
              {{ usageState.hasNetwork ? "Ready" : "Unavailable" }}
            </span>
          </div>
          <div class="h-4 w-px bg-border/35" />
          <div class="flex min-w-0 items-center gap-2">
            <BatteryCharging class="h-3.5 w-3.5 text-success" />
            <span class="text-muted-foreground/55">Battery</span>
            <span
              class="font-medium"
              :class="usageState.hasBattery ? 'text-success' : 'text-muted-foreground/45'"
            >
              {{ usageState.hasBattery ? "Ready" : "Unavailable" }}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            class="ml-auto h-7 gap-1.5 px-2 text-2xs"
            :disabled="
              panel.inspector.isLoadingNetwork.value || panel.inspector.isLoadingBattery.value
            "
            @click="void refreshUsage()"
          >
            <RefreshCw class="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>

        <div class="grid gap-3 2xl:grid-cols-2">
          <section class="overflow-hidden rounded-lg border border-border/25 bg-surface-0">
            <AppNetworkTab
              :stats="panel.inspector.networkStats.value"
              :is-loading="panel.inspector.isLoadingNetwork.value"
              :error="panel.inspector.networkError.value"
              @refresh="void refreshUsage()"
            />
          </section>

          <section class="overflow-hidden rounded-lg border border-border/25 bg-surface-0">
            <AppBatteryTab
              :stats="panel.inspector.batteryStats.value"
              :is-loading="panel.inspector.isLoadingBattery.value"
              :error="panel.inspector.batteryError.value"
              @refresh="void refreshUsage()"
            />
          </section>
        </div>
      </div>
    </ScrollArea>
  </div>
</template>
