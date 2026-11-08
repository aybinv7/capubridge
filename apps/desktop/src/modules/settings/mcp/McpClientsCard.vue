<script setup lang="ts">
import { ref } from "vue";
import { Button, Input, ToggleButton, ToggleGroup } from "@capubridge/cladd";
import type { McpCapability, McpPrincipalSummary } from "@/types/mcp.types";
import CopyAction from "@/shared/components/presentation/CopyAction.vue";
import SettingsCard from "../components/SettingsCard.vue";
import McpClientRow from "./McpClientRow.vue";
import { CAPABILITY_LABEL, CAPABILITY_OPTIONS } from "./mcpCapabilities";

const props = defineProps<{
  clients: McpPrincipalSummary[];
  issuedToken: string;
  creating: boolean;
  revokingId: string | null;
  create: (name: string, capabilities: McpCapability[]) => Promise<boolean>;
}>();

const emit = defineEmits<{ revoke: [client: McpPrincipalSummary] }>();

const name = ref("");
const capabilities = ref<McpCapability[]>(["read"]);

function isCapability(value: string): value is McpCapability {
  return value in CAPABILITY_LABEL;
}

function setCapabilities(value: string | string[] | undefined) {
  const list = Array.isArray(value) ? value : value ? [value] : [];
  capabilities.value = list.filter(isCapability);
}

async function submit() {
  if (await props.create(name.value, capabilities.value)) name.value = "";
}
</script>

<template>
  <SettingsCard
    title="Clients"
    description="Each assistant gets its own token and permissions, and can be revoked on its own."
  >
    <form class="flex flex-col gap-2.5 px-3.5 py-3" @submit.prevent="submit">
      <div class="flex items-center gap-2">
        <Input
          v-model="name"
          size="sm"
          class="min-w-0 flex-1"
          placeholder="Name, for example Claude Desktop"
          aria-label="Client name"
        />
        <Button
          type="submit"
          size="sm"
          variant="solid-fill"
          color="brand"
          :loading="props.creating"
        >
          Add client
        </Button>
      </div>
      <ToggleGroup
        multiple
        size="xs"
        aria-label="What this client may do"
        :value="capabilities"
        @update:value="setCapabilities"
      >
        <ToggleButton v-for="option in CAPABILITY_OPTIONS" :key="option.id" :value="option.id">
          {{ CAPABILITY_LABEL[option.id] }}
        </ToggleButton>
      </ToggleGroup>
      <ul class="flex flex-col gap-0.5 text-2xs text-muted-foreground">
        <li v-for="option in CAPABILITY_OPTIONS" :key="option.id" class="flex gap-1.5">
          <span
            class="w-16 shrink-0"
            :class="
              capabilities.includes(option.id) ? 'text-foreground' : 'text-[var(--fg-subtle)]'
            "
            >{{ CAPABILITY_LABEL[option.id] }}</span
          >
          <span :class="!capabilities.includes(option.id) && 'text-[var(--fg-subtle)]'">{{
            option.hint
          }}</span>
        </li>
      </ul>
    </form>

    <div v-if="props.issuedToken" class="flex flex-col gap-1.5 bg-signal-select/8 px-3.5 py-3">
      <span class="text-xs text-foreground">New token. Copy it now; it is not shown again.</span>
      <span class="flex items-center gap-2">
        <code class="min-w-0 flex-1 truncate font-mono text-2xs text-muted-foreground">{{
          props.issuedToken
        }}</code>
        <CopyAction :value="props.issuedToken" label="Copy the new token" />
      </span>
    </div>

    <p v-if="props.clients.length === 0" class="px-3.5 py-3 text-2xs text-muted-foreground">
      No clients yet. Add one above and paste its token into the assistant.
    </p>
    <McpClientRow
      v-for="client in props.clients"
      :key="client.id"
      :client="client"
      :revoking="props.revokingId === client.id"
      @revoke="emit('revoke', client)"
    />
  </SettingsCard>
</template>
