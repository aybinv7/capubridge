<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { ArrowDown, ArrowUp, Wifi } from "lucide-vue-next";
import { Button, Spinner } from "@capubridge/cladd";
import type { AppNetworkStats } from "@/types/app-inspector.types";
import HintTooltip from "@/shared/components/presentation/HintTooltip.vue";
import { formatBytes } from "@/shared/format/numbers";
import PerfCard from "@/shared/perf/PerfCard.vue";
import { networkTotal } from "../usage/netstats";

const props = defineProps<{
  stats: AppNetworkStats | undefined;
  /** The app's Linux uid, which keys its traffic counters. */
  uid: number | null;
  loading: boolean;
  error: unknown;
}>();

const router = useRouter();

const total = computed(() => (props.stats?.available ? networkTotal(props.stats) : null));
const rows = computed(() => {
  const stats = props.stats;
  if (!stats?.available) return [];
  return [
    { key: "wifi", label: "Wi-Fi", down: stats.wifiRxBytes, up: stats.wifiTxBytes },
    { key: "mobile", label: "Mobile data", down: stats.mobileRxBytes, up: stats.mobileTxBytes },
  ];
});

function openRequests() {
  void router.push({ name: "network-requests" });
}
</script>

<template>
  <PerfCard
    title="Data used"
    :value="total === null ? undefined : formatBytes(total)"
    :detail="total === null ? undefined : 'Since the phone started'"
  >
    <template #icon><Wifi :size="13" :stroke-width="1.8" aria-hidden="true" /></template>
    <template #aside>
      <HintTooltip
        v-if="props.uid !== null"
        text="The app's Linux user id, which keys its counters"
      >
        <span class="font-mono text-2xs text-[var(--fg-subtle)] tabular-nums">
          uid {{ props.uid }}
        </span>
      </HintTooltip>
    </template>
    <div v-if="props.error" class="flex flex-col gap-0.5" role="alert">
      <p class="text-xs text-foreground">The phone did not send the traffic counters.</p>
      <p class="font-mono text-2xs break-all text-error">{{ props.error }}</p>
    </div>
    <div
      v-else-if="props.loading && !props.stats"
      class="flex items-center gap-2 text-xs text-muted-foreground"
    >
      <Spinner size="xs" />
      Reading the app's traffic counters
    </div>
    <div v-else-if="!props.stats?.available" class="flex items-center justify-between gap-3">
      <p class="min-w-0 text-xs text-muted-foreground">
        Android 10 and later keep per-app traffic private; Network lists what the WebView loads.
      </p>
      <Button size="sm" variant="transparent" class="shrink-0" @click="openRequests">
        Open Network
      </Button>
    </div>
    <dl v-else class="flex flex-col divide-y divide-border-subtle">
      <div
        v-for="row in rows"
        :key="row.key"
        class="grid grid-cols-[6rem_1fr_1fr] items-center gap-3 py-1.5"
      >
        <dt class="text-xs text-muted-foreground">{{ row.label }}</dt>
        <dd class="flex items-center justify-end gap-1 font-mono text-sm tabular-nums">
          <ArrowDown :size="11" class="text-[var(--fg-subtle)]" aria-hidden="true" />
          <span class="sr-only">Received</span>
          {{ formatBytes(row.down) }}
        </dd>
        <dd class="flex items-center justify-end gap-1 font-mono text-sm tabular-nums">
          <ArrowUp :size="11" class="text-[var(--fg-subtle)]" aria-hidden="true" />
          <span class="sr-only">Sent</span>
          {{ formatBytes(row.up) }}
        </dd>
      </div>
    </dl>
  </PerfCard>
</template>
