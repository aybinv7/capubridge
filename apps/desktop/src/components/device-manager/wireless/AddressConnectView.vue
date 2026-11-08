<script setup lang="ts">
import { ref } from "vue";
import { Cable } from "lucide-vue-next";
import { Button, Input } from "@capubridge/cladd";
import { useDeviceNamesStore } from "@/stores/deviceNames.store";
import type { ADBDevice } from "@/types/adb.types";

const props = defineProps<{
  usbDevices: ADBDevice[];
  switching: boolean;
  connecting: boolean;
  connect: (host: string, port: number) => Promise<boolean>;
  switchToWifi: (device: ADBDevice) => Promise<boolean>;
}>();

const deviceNames = useDeviceNamesStore();
const host = ref("");
const port = ref("5555");
const switchingSerial = ref<string | null>(null);

async function submit() {
  await props.connect(host.value, Number.parseInt(port.value, 10) || 5555);
}

async function switchDevice(device: ADBDevice) {
  switchingSerial.value = device.serial;
  try {
    await props.switchToWifi(device);
  } finally {
    switchingSerial.value = null;
  }
}

const sectionClass = "flex flex-col gap-3 rounded-well bg-surface-cut px-4 py-3.5 shadow-cut";
const fieldLabel = "text-2xs text-[var(--fg-subtle)]";
</script>

<template>
  <div class="flex flex-col gap-3">
    <section :class="sectionClass" aria-labelledby="legacy-title">
      <div class="flex flex-col gap-1">
        <h3 id="legacy-title" class="text-sm font-medium text-foreground">Android 10 and older</h3>
        <p class="text-xs text-muted-foreground">
          Pairing without a cable needs Android 11 or later. On older phones, plug in the cable
          once: Capubridge turns on Wi-Fi debugging, and then the cable can go.
        </p>
      </div>
      <ul v-if="props.usbDevices.length" class="flex flex-col gap-1">
        <li
          v-for="device in props.usbDevices"
          :key="device.serial"
          class="flex items-center gap-3 rounded-control py-1"
        >
          <Cable class="size-4 shrink-0 text-muted-foreground" :stroke-width="1.7" />
          <span class="min-w-0 flex-1 truncate text-sm text-foreground">
            {{ deviceNames.nameOf(device) }}
          </span>
          <Button
            variant="solid"
            surface-level="+2"
            size="sm"
            :loading="switchingSerial === device.serial"
            :disabled="props.switching && switchingSerial !== device.serial"
            @click="switchDevice(device)"
          >
            Switch to Wi-Fi
          </Button>
        </li>
      </ul>
      <p v-else class="text-xs text-[var(--fg-subtle)]">
        No phone on USB right now. Plug one in and it appears here.
      </p>
    </section>

    <section :class="sectionClass" aria-labelledby="address-title">
      <div class="flex flex-col gap-1">
        <h3 id="address-title" class="text-sm font-medium text-foreground">Connect by address</h3>
        <p class="text-xs text-muted-foreground">
          For a phone already listening on Wi-Fi: the address under Wireless debugging, or port 5555
          after Switch to Wi-Fi.
        </p>
      </div>
      <form class="flex items-end gap-2" @submit.prevent="submit">
        <label class="flex min-w-0 flex-1 flex-col gap-1">
          <span :class="fieldLabel">IP address</span>
          <Input v-model="host" placeholder="192.168.1.20" input-class-name="font-mono" />
        </label>
        <label class="flex w-24 flex-col gap-1">
          <span :class="fieldLabel">Port</span>
          <Input v-model="port" input-mode="numeric" input-class-name="font-mono" />
        </label>
        <Button type="submit" variant="solid-fill" color="brand" :loading="props.connecting">
          Connect
        </Button>
      </form>
    </section>
  </div>
</template>
