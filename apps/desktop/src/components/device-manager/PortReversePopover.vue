<script setup lang="ts">
import { ref } from "vue";
import { ArrowLeftRight, ArrowRight, Plus, X } from "lucide-vue-next";
import { toast } from "vue-sonner";
import { Button, Input, Popover, Spinner } from "@capubridge/cladd";
import { useAdb } from "@/composables/useAdb";
import type { ReverseRule } from "@/types/adb.types";
import IconAction from "@/shared/components/presentation/IconAction.vue";

const props = defineProps<{ serial: string }>();

const { reverse, removeReverse, listReverse } = useAdb();

const open = ref(false);
const anchor = ref<HTMLElement | null>(null);
const rules = ref<ReverseRule[]>([]);
const loading = ref(false);
const loadError = ref<string | null>(null);
const adding = ref(false);
const devicePort = ref("");
const localPort = ref("");

function parsePort(value: string): number | null {
  const port = Number(value.trim());
  return Number.isInteger(port) && port > 0 && port < 65536 ? port : null;
}

async function loadRules() {
  loading.value = true;
  loadError.value = null;
  try {
    rules.value = await listReverse(props.serial);
  } catch (error) {
    rules.value = [];
    loadError.value = String(error);
  } finally {
    loading.value = false;
  }
}

function toggle() {
  open.value = !open.value;
  if (open.value) void loadRules();
}

async function addRule() {
  const remote = parsePort(devicePort.value);
  const local = parsePort(localPort.value || devicePort.value);
  if (remote === null || local === null) {
    toast.error("Enter ports between 1 and 65535");
    return;
  }
  adding.value = true;
  try {
    await reverse(props.serial, remote, local);
    rules.value = [
      ...rules.value.filter((rule) => rule.remotePort !== remote),
      { remotePort: remote, localPort: local },
    ];
    devicePort.value = "";
    localPort.value = "";
  } catch (error) {
    toast.error("Could not add the rule", { description: String(error) });
  } finally {
    adding.value = false;
  }
}

async function removeRule(rule: ReverseRule) {
  try {
    await removeReverse(props.serial, rule.remotePort);
    rules.value = rules.value.filter((entry) => entry.remotePort !== rule.remotePort);
  } catch (error) {
    toast.error("Could not remove the rule", { description: String(error) });
  }
}
</script>

<template>
  <span ref="anchor" class="inline-flex">
    <IconAction
      label="Port reverse rules"
      hint="Let the device reach a port on this computer"
      :pressed="open"
      aria-haspopup="dialog"
      :aria-expanded="open"
      @click="toggle"
    >
      <ArrowLeftRight :stroke-width="1.8" />
    </IconAction>
  </span>

  <Popover
    v-model:open="open"
    :anchor-element="anchor ?? undefined"
    position="bottom-end"
    :offset="6"
    class="w-72"
    content-class-name="w-full p-3"
    aria-label="Port reverse rules"
  >
    <div class="flex flex-col gap-3">
      <div class="flex flex-col gap-1">
        <p class="text-sm font-medium text-foreground">Port reverse</p>
        <p class="text-xs text-muted-foreground">
          The device reaches <span class="font-mono">localhost:port</span> on this computer.
        </p>
      </div>

      <form class="flex items-end gap-1.5" @submit.prevent="addRule">
        <label class="flex min-w-0 flex-1 flex-col gap-1">
          <span class="text-2xs text-[var(--fg-subtle)]">Device port</span>
          <Input
            v-model="devicePort"
            size="sm"
            input-mode="numeric"
            placeholder="5173"
            input-class-name="font-mono"
          />
        </label>
        <ArrowRight :size="12" class="mb-2 shrink-0 text-[var(--fg-subtle)]" aria-hidden="true" />
        <label class="flex min-w-0 flex-1 flex-col gap-1">
          <span class="text-2xs text-[var(--fg-subtle)]">Local port</span>
          <Input
            v-model="localPort"
            size="sm"
            input-mode="numeric"
            :placeholder="devicePort || 'same'"
            input-class-name="font-mono"
          />
        </label>
        <Button
          type="submit"
          variant="solid"
          surface-level="+2"
          size="sm"
          square
          :loading="adding"
          aria-label="Add rule"
          content-class-name="[&>svg]:size-3.5"
        >
          <Plus :stroke-width="1.8" />
        </Button>
      </form>

      <div v-if="loading" class="flex items-center gap-2 text-xs text-muted-foreground">
        <Spinner size="xs" /> Reading rules
      </div>
      <p v-else-if="loadError" class="text-xs text-error">
        Could not read the rules: <span class="font-mono">{{ loadError }}</span>
      </p>
      <ul v-else-if="rules.length" class="flex flex-col gap-0.5">
        <li
          v-for="rule in rules"
          :key="rule.remotePort"
          class="flex h-7 items-center gap-2 rounded-cladd-md pr-0.5 pl-2 hover:bg-cladd-surface-hover"
        >
          <span class="flex-1 font-mono text-xs text-foreground">
            {{ rule.remotePort }}
            <span class="text-[var(--fg-subtle)]">→</span>
            {{ rule.localPort }}
          </span>
          <IconAction
            :label="`Remove ${rule.remotePort} → ${rule.localPort}`"
            size="sm"
            position="top"
            @click="removeRule(rule)"
          >
            <X :stroke-width="1.8" />
          </IconAction>
        </li>
      </ul>
      <p v-else class="text-xs text-[var(--fg-subtle)]">No rules on this device.</p>
    </div>
  </Popover>
</template>
