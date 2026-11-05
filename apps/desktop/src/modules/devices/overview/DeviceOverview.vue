<script setup lang="ts">
import { computed } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { Copy, RefreshCw } from "lucide-vue-next";
import { Button, Spinner } from "@capubridge/cladd";
import { toast } from "vue-sonner";
import { useAdb } from "@/composables/useAdb";
import { useCommandProvider } from "@/composables/useCommandProvider";
import { useDevicesStore } from "@/stores/devices.store";
import OverviewApp from "./OverviewApp.vue";
import FactList from "@/shared/facts/FactList.vue";
import OverviewHeader from "./OverviewHeader.vue";
import OverviewVitals from "./OverviewVitals.vue";
import { deviceFacts } from "./deviceFacts";

const devicesStore = useDevicesStore();
const { getDeviceOverview } = useAdb();

const device = computed(() => devicesStore.selectedDevice);
const serial = computed(() => device.value?.serial ?? "");

const {
  data: info,
  isLoading,
  isFetching,
  isError,
  error,
  refetch,
} = useQuery({
  queryKey: computed(() => ["device-info", serial.value]),
  queryFn: ({ signal }) => getDeviceOverview(serial.value, { signal }),
  enabled: computed(() => !!serial.value),
  staleTime: 30_000,
});

const facts = computed(() => (info.value ? deviceFacts(info.value, serial.value) : []));
const androidVersion = computed(
  () => info.value?.androidVersion || device.value?.androidVersion || null,
);
const apiLevel = computed(() => info.value?.apiLevel || device.value?.apiLevel || null);

async function copySerial() {
  try {
    await navigator.clipboard.writeText(serial.value);
    toast.success("Serial copied");
  } catch (err) {
    toast.error("Could not copy the serial", { description: String(err) });
  }
}

useCommandProvider("screen.device-overview", () => [
  {
    id: "device.refresh-info",
    title: "Refresh device info",
    group: "Devices",
    icon: RefreshCw,
    screen: true,
    keywords: ["reload", "overview", "specs"],
    when: () => serial.value !== "",
    run: () => refetch(),
  },
  {
    id: "device.copy-serial",
    title: "Copy device serial",
    group: "Devices",
    icon: Copy,
    screen: true,
    keywords: ["serial", "id", "adb"],
    when: () => serial.value !== "",
    run: copySerial,
  },
]);
</script>

<template>
  <div class="h-full overflow-y-auto">
    <div v-if="device" class="mx-auto flex max-w-4xl flex-col gap-7 px-8 py-7">
      <OverviewHeader
        :device="device"
        :android-version="androidVersion"
        :api-level="apiLevel"
        :refreshing="isFetching"
        @refresh="refetch()"
      />

      <OverviewVitals />

      <OverviewApp :serial="serial" />

      <div v-if="isLoading" class="flex items-center gap-2 text-xs text-muted-foreground">
        <Spinner size="xs" />
        Reading the phone's details
      </div>
      <div
        v-else-if="isError || (!info && !isFetching)"
        class="flex items-start gap-3 rounded-control bg-surface-cut px-3 py-2.5 shadow-cut"
        role="alert"
      >
        <div class="flex min-w-0 flex-1 flex-col gap-0.5">
          <p class="text-xs text-foreground">The phone did not send its details.</p>
          <p v-if="error" class="font-mono text-2xs break-all text-error">{{ error }}</p>
        </div>
        <Button size="sm" variant="transparent" @click="refetch()">Try again</Button>
      </div>
      <FactList v-else-if="facts.length" title="About this phone" :facts="facts" />
    </div>
  </div>
</template>
