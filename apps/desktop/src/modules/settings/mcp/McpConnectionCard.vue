<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Eye, EyeOff } from "lucide-vue-next";
import { Button, Input, Switch } from "@capubridge/cladd";
import CopyAction from "@/shared/components/presentation/CopyAction.vue";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import SettingsCard from "../components/SettingsCard.vue";
import SettingsRow from "../components/SettingsRow.vue";

const props = defineProps<{
  endpointUrl: string;
  token: string;
  port: number;
  allowMutations: boolean;
  busy: boolean;
}>();

const emit = defineEmits<{
  regenerate: [];
  applyPort: [port: number];
  allowMutations: [value: boolean];
}>();

const showToken = ref(false);
const portInput = ref(String(props.port));

watch(
  () => props.port,
  (port) => {
    portInput.value = String(port);
  },
);

const parsedPort = computed(() => Number(portInput.value));
const portValid = computed(
  () => Number.isInteger(parsedPort.value) && parsedPort.value >= 1 && parsedPort.value <= 65535,
);
const portChanged = computed(() => portValid.value && parsedPort.value !== props.port);

const shownToken = computed(() => {
  if (!props.token) return "Shown once, when made or rotated";
  return showToken.value ? props.token : "•".repeat(Math.min(props.token.length, 32));
});
</script>

<template>
  <SettingsCard title="Connection" description="What an MCP client needs to reach Capubridge.">
    <SettingsRow label="Address" description="Streamable HTTP.">
      <code class="max-w-[240px] truncate font-mono text-2xs text-muted-foreground">{{
        props.endpointUrl
      }}</code>
      <CopyAction :value="props.endpointUrl" label="Copy the address" />
    </SettingsRow>

    <SettingsRow
      label="Token"
      description="The last one made here, sent as a Bearer token in the Authorization header."
    >
      <code
        class="max-w-[200px] truncate font-mono text-2xs"
        :class="props.token ? 'text-muted-foreground' : 'text-[var(--fg-subtle)]'"
        >{{ shownToken }}</code
      >
      <template v-if="props.token">
        <IconAction
          :label="showToken ? 'Hide the token' : 'Show the token'"
          size="sm"
          @click="showToken = !showToken"
        >
          <EyeOff v-if="showToken" :stroke-width="1.8" />
          <Eye v-else :stroke-width="1.8" />
        </IconAction>
        <CopyAction :value="props.token" label="Copy the token" />
      </template>
      <Button size="xs" variant="solid" :disabled="props.busy" @click="emit('regenerate')">
        New shared token
      </Button>
    </SettingsRow>

    <SettingsRow label="Port" description="On this computer only. 8765 unless you change it.">
      <form class="flex items-center gap-2" @submit.prevent="emit('applyPort', parsedPort)">
        <Input
          v-model="portInput"
          size="sm"
          class="w-20"
          input-class-name="font-mono tabular-nums"
          input-mode="numeric"
          aria-label="Port"
          :valid="portValid ? undefined : false"
        />
        <Button size="xs" variant="solid" type="submit" :disabled="props.busy || !portChanged">
          Apply
        </Button>
      </form>
    </SettingsRow>

    <SettingsRow
      label="Shared token can change things"
      description="For setups made before clients had their own tokens. New clients choose their own permissions."
    >
      <Switch
        :model-value="props.allowMutations"
        :disabled="props.busy"
        aria-label="Shared token can change things"
        @update:model-value="emit('allowMutations', $event)"
      />
    </SettingsRow>
  </SettingsCard>
</template>
