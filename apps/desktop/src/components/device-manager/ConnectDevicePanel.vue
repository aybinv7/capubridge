<script setup lang="ts">
import { computed, ref } from "vue";
import { Segmented, SegmentedButton } from "@capubridge/cladd";
import { useWirelessDiscovery } from "@/composables/useWirelessDiscovery";
import { nearbyPhones, type NearbyPhone } from "@/lib/wireless/nearbyPhones";
import { useDevicesStore } from "@/stores/devices.store";
import type { ADBDevice } from "@/types/adb.types";
import AddressConnectView from "./wireless/AddressConnectView.vue";
import CodePairingView from "./wireless/CodePairingView.vue";
import NearbyPhonesList from "./wireless/NearbyPhonesList.vue";
import QrPairingView from "./wireless/QrPairingView.vue";

type ConnectMethod = "qr" | "code" | "address";

const DISCOVERY_INTERVAL_MS = 1000;

const METHODS: { value: ConnectMethod; label: string }[] = [
  { value: "qr", label: "QR code" },
  { value: "code", label: "Pairing code" },
  { value: "address", label: "Cable or address" },
];

const props = defineProps<{
  connecting: boolean;
  switchingToWifi: boolean;
  connectingGuid: string | null;
  connect: (host: string, port: number) => Promise<boolean>;
  switchToWifi: (device: ADBDevice) => Promise<boolean>;
}>();
const emit = defineEmits<{
  connected: [serial: string, guid: string | null];
  connectNearby: [phone: NearbyPhone];
}>();

const devicesStore = useDevicesStore();
const method = ref<ConnectMethod>("qr");

const { services, status } = useWirelessDiscovery(DISCOVERY_INTERVAL_MS);

const phones = computed(() => nearbyPhones(services.value, devicesStore.devices));
const usbDevices = computed(() =>
  devicesStore.devices.filter(
    (device) => device.connectionType === "usb" && device.status === "online" && !device.isStale,
  ),
);
const discoveryNote = computed(() => {
  if (status.value === "adbUnavailable")
    return "ADB is not running, so nearby phones cannot be listed.";
  if (status.value === "discoveryUnavailable")
    return "This computer cannot search the network. A pairing code or the cable still works.";
  return null;
});

function onConnected(serial: string, guid: string | null) {
  emit("connected", serial, guid);
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <header class="flex flex-col gap-3 px-5 pt-5 pb-4">
      <div class="flex flex-col gap-1">
        <h2 class="text-base font-medium text-foreground">Connect over Wi-Fi</h2>
        <p class="text-2xs text-[var(--fg-subtle)]">
          The phone and this computer must be on the same network. Guest or isolated Wi-Fi can hide
          the phone.
        </p>
      </div>
      <Segmented size="sm" aria-label="How to connect" class="self-start">
        <SegmentedButton
          v-for="option in METHODS"
          :key="option.value"
          :active="method === option.value"
          @click="method = option.value"
        >
          {{ option.label }}
        </SegmentedButton>
      </Segmented>
    </header>

    <div class="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overscroll-contain px-5 pb-5">
      <QrPairingView v-if="method === 'qr'" @connected="onConnected" />
      <CodePairingView
        v-else-if="method === 'code'"
        :services="services"
        @connected="onConnected"
      />
      <AddressConnectView
        v-else
        :usb-devices="usbDevices"
        :switching="props.switchingToWifi"
        :connecting="props.connecting"
        :connect="props.connect"
        :switch-to-wifi="props.switchToWifi"
      />

      <p v-if="discoveryNote" class="text-2xs text-[var(--fg-subtle)]">{{ discoveryNote }}</p>
      <NearbyPhonesList
        v-else-if="phones.length"
        :phones="phones"
        :connecting-guid="props.connectingGuid"
        @connect="emit('connectNearby', $event)"
      />
    </div>
  </div>
</template>
