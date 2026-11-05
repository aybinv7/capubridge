<script setup lang="ts">
import { computed } from "vue";
import { RefreshCw } from "lucide-vue-next";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import { useAppSession } from "../appSession";
import type { AppIdentity } from "../usage/appIdentity";
import { useAppUsage } from "../usage/useAppUsage";
import TotalsBattery from "./TotalsBattery.vue";
import TotalsData from "./TotalsData.vue";

const { app, dump } = useAppSession();
const details = app.details;

const identity = computed<AppIdentity | null | undefined>(() => {
  const appId = dump.appId.value;
  if (appId === null && (details.isLoading.value || dump.query.isLoading.value)) return undefined;
  return appId === null ? null : { user: details.data.value?.userId ?? 0, appId };
});
const { network, battery, uid } = useAppUsage(app.subject, identity);

const identityError = computed(() =>
  identity.value === null ? (details.error.value ?? dump.query.error.value ?? null) : null,
);
const refreshing = computed(() => network.isFetching.value || battery.isFetching.value);

async function refresh() {
  await Promise.all([network.refetch(), battery.refetch()]);
}
</script>

<template>
  <section id="totals" class="flex scroll-mt-4 flex-col gap-3" aria-labelledby="app-totals-title">
    <header class="flex items-center gap-2">
      <h2 id="app-totals-title" class="text-sm font-medium text-foreground">Totals so far</h2>
      <span class="min-w-0 flex-1 truncate text-xs text-[var(--fg-subtle)]">
        Counted by Android, read when this page opens
      </span>
      <IconAction label="Read the totals again" :loading="refreshing" @click="refresh">
        <RefreshCw :stroke-width="1.8" />
      </IconAction>
    </header>
    <div class="grid grid-cols-1 gap-3 @3xl:grid-cols-2">
      <TotalsData
        :stats="network.data.value"
        :uid="uid"
        :loading="network.isLoading.value || identity === undefined"
        :error="network.error.value ?? identityError"
      />
      <TotalsBattery
        :stats="battery.data.value"
        :loading="battery.isLoading.value || identity === undefined"
        :error="battery.error.value ?? identityError"
      />
    </div>
  </section>
</template>
