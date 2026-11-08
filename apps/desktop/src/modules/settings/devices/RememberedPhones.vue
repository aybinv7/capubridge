<script setup lang="ts">
import { Smartphone, Trash2, Wifi } from "lucide-vue-next";
import { Button, Switch } from "@capubridge/cladd";
import { usePairedPhonesStore, type PairedPhone } from "@/stores/pairedPhones.store";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import SettingsCard from "../components/SettingsCard.vue";

const emit = defineEmits<{ connect: [] }>();

const pairedPhones = usePairedPhonesStore();

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

function nameOf(phone: PairedPhone): string {
  return phone.label ?? "Phone paired over Wi-Fi";
}
</script>

<template>
  <SettingsCard
    title="Phones paired over Wi-Fi"
    description="Capubridge finds them on the network by themselves; no address is kept."
  >
    <template #aside>
      <Button
        size="xs"
        variant="transparent"
        :outline="false"
        content-class-name="gap-1.5"
        @click="emit('connect')"
      >
        <Wifi :size="12" aria-hidden="true" /> Connect over Wi-Fi
      </Button>
    </template>

    <p v-if="pairedPhones.phones.length === 0" class="px-3.5 py-3 text-2xs text-muted-foreground">
      A phone you pair with a QR code or a pairing code appears here.
    </p>
    <div
      v-for="phone in pairedPhones.phones"
      :key="phone.guid"
      class="flex min-h-12 items-center gap-3 px-3.5 py-2"
    >
      <Smartphone :size="14" :stroke-width="1.7" class="shrink-0 text-muted-foreground" />
      <span class="flex min-w-0 flex-1 flex-col gap-0.5">
        <span class="truncate text-xs text-foreground" :title="phone.guid">{{
          nameOf(phone)
        }}</span>
        <span class="text-2xs text-[var(--fg-subtle)]">
          Last connected {{ dateFormat.format(phone.lastConnectedAt) }}
        </span>
      </span>
      <label class="flex shrink-0 items-center gap-2 text-2xs text-muted-foreground">
        Reconnect by itself
        <Switch
          size="sm"
          :model-value="phone.autoReconnect"
          :aria-label="`Reconnect ${nameOf(phone)} by itself`"
          @update:model-value="pairedPhones.setAutoReconnect(phone.guid, $event)"
        />
      </label>
      <IconAction
        :label="`Forget ${nameOf(phone)}`"
        hint="It stays paired on the phone; it just stops reconnecting."
        size="sm"
        @click="pairedPhones.forget(phone.guid)"
      >
        <Trash2 :stroke-width="1.8" />
      </IconAction>
    </div>
  </SettingsCard>
</template>
