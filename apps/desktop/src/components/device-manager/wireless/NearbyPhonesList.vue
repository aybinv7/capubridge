<script setup lang="ts">
import { Smartphone } from "lucide-vue-next";
import { Button, Chip, Switch } from "@capubridge/cladd";
import type { NearbyPhone } from "@/lib/wireless/nearbyPhones";
import { usePairedPhonesStore } from "@/stores/pairedPhones.store";

const props = defineProps<{ phones: NearbyPhone[]; connectingGuid: string | null }>();
const emit = defineEmits<{ connect: [phone: NearbyPhone] }>();

const pairedPhones = usePairedPhonesStore();

function labelOf(phone: NearbyPhone) {
  return pairedPhones.find(phone.guid)?.label ?? "Phone with Wireless debugging on";
}
</script>

<template>
  <section class="flex flex-col gap-1.5" aria-labelledby="nearby-title">
    <h3 id="nearby-title" class="px-1 text-xs font-medium text-muted-foreground">Nearby phones</h3>
    <TransitionGroup
      tag="ul"
      class="flex flex-col gap-0.5"
      enter-active-class="transition duration-300 ease-cladd-spring motion-reduce:transition-none"
      enter-from-class="-translate-y-1 opacity-0"
      leave-active-class="transition duration-200 ease-in-out motion-reduce:transition-none"
      leave-to-class="opacity-0"
    >
      <li
        v-for="phone in props.phones"
        :key="phone.guid"
        class="flex items-center gap-3 rounded-control px-2 py-1.5 hover:bg-cladd-surface-hover"
      >
        <span
          class="flex size-8 shrink-0 items-center justify-center rounded-inner bg-surface-2 text-muted-foreground"
        >
          <Smartphone :size="15" :stroke-width="1.7" />
        </span>
        <span class="flex min-w-0 flex-1 flex-col">
          <span class="truncate text-sm text-foreground">{{ labelOf(phone) }}</span>
          <span class="truncate font-mono text-2xs text-[var(--fg-subtle)]">{{ phone.host }}</span>
        </span>
        <label
          v-if="pairedPhones.find(phone.guid)"
          class="flex shrink-0 items-center gap-2 text-2xs text-muted-foreground"
        >
          Reconnect by itself
          <Switch
            size="sm"
            :model-value="pairedPhones.find(phone.guid)?.autoReconnect ?? false"
            :aria-label="`Reconnect ${labelOf(phone)} by itself`"
            @update:model-value="pairedPhones.setAutoReconnect(phone.guid, $event)"
          />
        </label>
        <Chip v-if="phone.connectedSerial" size="sm" color="green">Connected</Chip>
        <Button
          v-else
          variant="solid"
          surface-level="+2"
          size="sm"
          :loading="props.connectingGuid === phone.guid"
          :disabled="props.connectingGuid !== null && props.connectingGuid !== phone.guid"
          @click="emit('connect', phone)"
        >
          Connect
        </Button>
      </li>
    </TransitionGroup>
  </section>
</template>
