<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Button, Input, OTPField, OTPFieldInput, OTPFieldSeparator } from "@capubridge/cladd";
import { codePairingServices } from "@/lib/wireless/nearbyPhones";
import type { MdnsService } from "@/types/wireless.types";
import PairingFailureNotice from "./PairingFailureNotice.vue";
import PairingProgress from "./PairingProgress.vue";
import { useWirelessPairing } from "./useWirelessPairing";

const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
const CODE_LENGTH = 6;

const props = defineProps<{ services: MdnsService[] }>();
const emit = defineEmits<{ connected: [serial: string, guid: string | null] }>();

const pairing = useWirelessPairing((serial, guid) => emit("connected", serial, guid));
const { state, starting, busy, startError } = pairing;

const host = ref("");
const port = ref("");
const code = ref("");
const addressEdited = ref(false);

const advertised = computed(() => codePairingServices(props.services));
const failure = computed(() => (state.value?.phase === "failed" ? state.value : null));
const running = computed(() => state.value !== null && !failure.value);

const portNumber = computed(() => Number.parseInt(port.value, 10));
const ready = computed(
  () =>
    IPV4.test(host.value.trim()) &&
    Number.isInteger(portNumber.value) &&
    portNumber.value > 0 &&
    portNumber.value < 65536 &&
    code.value.length === CODE_LENGTH,
);

function fill(service: MdnsService) {
  host.value = service.host;
  port.value = String(service.port);
}

watch(
  advertised,
  (services) => {
    const only = services.length === 1 ? services[0] : null;
    if (only && !addressEdited.value) fill(only);
  },
  { immediate: true },
);

function pick(service: MdnsService) {
  addressEdited.value = true;
  fill(service);
}

function submit() {
  if (!ready.value || busy.value) return;
  void pairing.startCode(host.value.trim(), portNumber.value, code.value);
}

function retry() {
  void pairing.cancel();
  code.value = "";
}

const fieldLabel = "text-2xs text-[var(--fg-subtle)]";
</script>

<template>
  <div class="flex flex-col gap-5">
    <p class="text-xs text-muted-foreground">
      On the phone: Settings › Developer options › Wireless debugging › Pair device with pairing
      code. It shows a six-digit code and an address.
    </p>

    <div v-if="advertised.length > 1" class="flex flex-col gap-1.5">
      <span :class="fieldLabel">Phones showing a code</span>
      <div class="flex flex-wrap gap-1.5">
        <Button
          v-for="service in advertised"
          :key="service.name"
          variant="solid"
          size="sm"
          content-class-name="font-mono"
          @click="pick(service)"
        >
          {{ service.host }}:{{ service.port }}
        </Button>
      </div>
    </div>

    <form class="flex flex-col gap-4" @submit.prevent="submit">
      <div class="flex items-end gap-2">
        <label class="flex min-w-0 flex-1 flex-col gap-1">
          <span :class="fieldLabel">IP address</span>
          <Input
            v-model="host"
            placeholder="192.168.1.20"
            input-class-name="font-mono"
            :disabled="running"
            @update:model-value="addressEdited = true"
          />
        </label>
        <label class="flex w-24 flex-col gap-1">
          <span :class="fieldLabel">Port</span>
          <Input
            v-model="port"
            placeholder="37261"
            input-mode="numeric"
            input-class-name="font-mono"
            :disabled="running"
            @update:model-value="addressEdited = true"
          />
        </label>
      </div>
      <p
        v-if="advertised.length === 1 && !addressEdited"
        class="-mt-2 text-2xs text-[var(--fg-subtle)]"
      >
        Filled in from the phone found on this network.
      </p>

      <div class="flex flex-col gap-1">
        <span :class="fieldLabel">Pairing code</span>
        <OTPField
          v-model="code"
          :max-length="CODE_LENGTH"
          size="md"
          :disabled="running"
          aria-label="Pairing code"
        >
          <OTPFieldInput />
          <OTPFieldInput />
          <OTPFieldInput />
          <OTPFieldSeparator />
          <OTPFieldInput />
          <OTPFieldInput />
          <OTPFieldInput />
        </OTPField>
      </div>

      <div v-if="!running && !failure" class="flex items-center gap-3">
        <Button
          type="submit"
          variant="solid-fill"
          color="brand"
          :disabled="!ready"
          :loading="starting"
        >
          Pair and connect
        </Button>
        <span v-if="startError" class="truncate text-xs text-error" :title="startError">
          {{ startError }}
        </span>
      </div>
    </form>

    <PairingFailureNotice
      v-if="failure"
      :reason="failure.reason"
      :detail="failure.detail"
      retry-label="Try again"
      @retry="retry"
    />
    <PairingProgress v-else-if="running" :state="state" />
  </div>
</template>
