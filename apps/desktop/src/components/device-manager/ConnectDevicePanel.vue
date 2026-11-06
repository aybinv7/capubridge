<script setup lang="ts">
import { ref } from "vue";
import { Button, Input } from "@capubridge/cladd";

const props = defineProps<{
  pairing: boolean;
  connecting: boolean;
  pair: (address: string, code: string) => Promise<boolean>;
  connect: (host: string, port: number) => Promise<boolean>;
}>();

const pairAddress = ref("");
const pairCode = ref("");
const host = ref("");
const port = ref("5555");

async function submitPair() {
  if (await props.pair(pairAddress.value, pairCode.value)) pairCode.value = "";
}

async function submitConnect() {
  await props.connect(host.value, Number.parseInt(port.value, 10) || 5555);
}

const sectionClass = "flex flex-col gap-3 rounded-well bg-surface-cut px-4 py-3.5 shadow-cut";
const fieldLabel = "text-2xs text-[var(--fg-subtle)]";
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <header class="flex flex-col gap-1 px-5 pt-5 pb-4">
      <h2 class="text-base font-medium text-foreground">Connect a device over Wi-Fi</h2>
      <p class="text-2xs text-[var(--fg-subtle)]">
        The device and this computer must be on the same network.
      </p>
    </header>

    <div class="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 pb-5">
      <section :class="sectionClass" aria-labelledby="pair-title">
        <div class="flex flex-col gap-1">
          <h3 id="pair-title" class="text-sm font-medium text-foreground">
            Pair with a code
            <span class="font-normal text-[var(--fg-subtle)]">Android 11 and later</span>
          </h3>
          <p class="text-xs text-muted-foreground">
            On the device: Settings › Developer options › Wireless debugging › Pair device with
            pairing code. Enter the address and code it shows, then connect below.
          </p>
        </div>
        <form class="flex items-end gap-2" @submit.prevent="submitPair">
          <label class="flex min-w-0 flex-1 flex-col gap-1">
            <span :class="fieldLabel">Pairing address</span>
            <Input
              v-model="pairAddress"
              placeholder="192.168.1.20:37261"
              input-class-name="font-mono"
            />
          </label>
          <label class="flex w-28 flex-col gap-1">
            <span :class="fieldLabel">Code</span>
            <Input
              v-model="pairCode"
              placeholder="123456"
              input-mode="numeric"
              :max-length="6"
              input-class-name="font-mono"
            />
          </label>
          <Button type="submit" variant="solid" surface-level="+2" :loading="props.pairing">
            Pair
          </Button>
        </form>
      </section>

      <section :class="sectionClass" aria-labelledby="connect-title">
        <div class="flex flex-col gap-1">
          <h3 id="connect-title" class="text-sm font-medium text-foreground">Connect by address</h3>
          <p class="text-xs text-muted-foreground">
            Use the address under Wireless debugging. On Android 10 and older, first run
            <span class="font-mono text-foreground">adb tcpip 5555</span> with the device on USB, or
            use “Use Wi-Fi” on a USB device.
          </p>
        </div>
        <form class="flex items-end gap-2" @submit.prevent="submitConnect">
          <label class="flex min-w-0 flex-1 flex-col gap-1">
            <span :class="fieldLabel">IP address</span>
            <Input v-model="host" placeholder="192.168.1.20" input-class-name="font-mono" />
          </label>
          <label class="flex w-24 flex-col gap-1">
            <span :class="fieldLabel">Port</span>
            <Input v-model="port" input-mode="numeric" input-class-name="font-mono" />
          </label>
          <Button type="submit" variant="solid-fill" color="brand" :loading="props.connecting"
            >Connect</Button
          >
        </form>
      </section>
    </div>
  </div>
</template>
