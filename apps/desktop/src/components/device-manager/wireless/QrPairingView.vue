<script setup lang="ts">
import { computed, onMounted } from "vue";
import { Spinner } from "@capubridge/cladd";
import PairingFailureNotice from "./PairingFailureNotice.vue";
import PairingProgress from "./PairingProgress.vue";
import PairingSteps from "./PairingSteps.vue";
import QrCodeImage from "./QrCodeImage.vue";
import { useWirelessPairing } from "./useWirelessPairing";

const emit = defineEmits<{ connected: [serial: string, guid: string | null] }>();

const pairing = useWirelessPairing((serial, guid) => emit("connected", serial, guid));
const { session, state, starting, startError } = pairing;

const STEPS = [
  "On the phone, open Settings › Developer options.",
  "Tap Wireless debugging, then Pair device with QR code.",
  "Scan this code. Capubridge pairs and connects on its own.",
];

const failure = computed(() => (state.value?.phase === "failed" ? state.value : null));
const qr = computed(() => session.value?.qr ?? null);

function start() {
  void pairing.startQr();
}

onMounted(start);
</script>

<template>
  <div class="flex flex-col items-center gap-5">
    <div
      class="relative flex size-52 shrink-0 items-center justify-center overflow-hidden rounded-surface bg-white p-1.5 shadow-bevel"
    >
      <Transition
        enter-active-class="transition duration-500 ease-cladd-settle motion-reduce:transition-none"
        enter-from-class="scale-95 opacity-0"
        leave-active-class="transition duration-200 ease-in-out motion-reduce:transition-none"
        leave-to-class="opacity-0"
        mode="out-in"
      >
        <QrCodeImage
          v-if="qr"
          :key="session?.id"
          :matrix="qr"
          :dimmed="Boolean(failure)"
          label="QR code to pair a phone over Wi-Fi"
        />
        <Spinner v-else size="sm" class="text-black" />
      </Transition>
    </div>

    <div class="flex w-full max-w-md flex-col items-center gap-4">
      <div v-if="startError" class="flex w-full flex-col gap-1" role="alert">
        <p class="text-sm font-medium text-foreground">Could not create a QR code</p>
        <p class="truncate font-mono text-2xs text-[var(--fg-subtle)]" :title="startError">
          {{ startError }}
        </p>
      </div>
      <PairingFailureNotice
        v-else-if="failure"
        class="w-full"
        :reason="failure.reason"
        :detail="failure.detail"
        retry-label="Show a new QR code"
        :retrying="starting"
        @retry="start"
      />
      <PairingProgress v-else :state="state" waiting-hint="Scan the code from the phone." />

      <PairingSteps v-if="!failure" :steps="STEPS" />
    </div>
  </div>
</template>
