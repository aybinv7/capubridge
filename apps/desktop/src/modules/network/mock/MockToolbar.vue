<script setup lang="ts">
import { computed } from "vue";
import { ChevronDown, CircleHelp, Plus, Upload } from "lucide-vue-next";
import {
  Button,
  NumberField,
  Segmented,
  SegmentedButton,
  StatusDot,
  Tooltip,
} from "@capubridge/cladd";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import { DEFAULT_RULE_TEMPLATES, type MockInterceptMode, type MockRule } from "@/types/mock.types";
import { MODES, PORT_MAX, PORT_MIN, clampInteger } from "./mockView";

const mode = defineModel<MockInterceptMode>("mode", { required: true });
const port = defineModel<number>("port", { required: true });
const guideOpen = defineModel<boolean>("guideOpen", { required: true });

const props = defineProps<{
  serverRunning: boolean;
  hasTarget: boolean;
  canReverse: boolean;
  reversing: boolean;
  transferPending: boolean;
  scope: { label: string; detail: string };
  summary: string;
}>();

const emit = defineEmits<{
  reverse: [];
  import: [];
  create: [template?: Partial<MockRule>];
}>();

const portModel = computed({
  get: () => port.value,
  set: (value: unknown) => {
    port.value = clampInteger(value, PORT_MIN, PORT_MAX, port.value);
  },
});
</script>

<template>
  <div
    class="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1.5 border-b border-border-subtle px-3 py-2"
  >
    <span class="shrink-0 text-xs text-muted-foreground">Interception</span>
    <Segmented size="sm" aria-label="How requests are intercepted">
      <SegmentedButton
        v-for="option in MODES"
        :key="option.value"
        :active="mode === option.value"
        :title="option.hint"
        content-class-name="gap-1.5"
        @click="mode = option.value"
      >
        <StatusDot v-if="option.value !== 'off' && mode === option.value" color="cyan" size="xs" />
        {{ option.label }}
      </SegmentedButton>
    </Segmented>

    <template v-if="mode === 'http'">
      <label class="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
        Port
        <NumberField
          v-model="portModel"
          size="sm"
          :min="PORT_MIN"
          :max="PORT_MAX"
          :step="1"
          class="w-24"
          input-class-name="font-mono"
          aria-label="Mock server port"
        />
      </label>
      <span class="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground" role="status">
        <StatusDot
          :color="props.serverRunning ? 'green' : undefined"
          :variant="props.serverRunning ? 'solid' : 'hollow'"
        />
        {{ props.serverRunning ? "Server running" : "Server stopped" }}
      </span>
      <Button
        size="sm"
        variant="transparent"
        :disabled="!props.canReverse"
        :loading="props.reversing"
        :title="
          props.canReverse
            ? `Make localhost:${port} on the phone reach this computer (adb reverse)`
            : 'Select an app on a phone first'
        "
        class="shrink-0"
        @click="emit('reverse')"
      >
        Connect the phone
      </Button>
    </template>
    <span
      v-else-if="mode === 'cdp' && !props.hasTarget"
      class="shrink-0 text-xs text-warning"
      role="status"
    >
      Waiting for an app: choose one, or use the local server.
    </span>

    <span class="flex-1" />

    <Tooltip position="bottom" :offset="6" content-class-name="max-w-80 px-2 py-1 text-xs">
      <template #trigger>
        <span class="max-w-60 shrink truncate text-xs text-muted-foreground">
          {{ props.scope.label }}
        </span>
      </template>
      {{ props.scope.detail }}
    </Tooltip>
    <span class="shrink-0 text-xs text-[var(--fg-subtle)] tabular-nums">{{ props.summary }}</span>

    <IconAction
      label="How interception works"
      toggle
      :pressed="guideOpen"
      @click="guideOpen = !guideOpen"
    >
      <CircleHelp :stroke-width="1.8" />
    </IconAction>
    <IconAction
      label="Import a rule"
      hint="Adds a rule exported from Capubridge to this app's rules"
      :loading="props.transferPending"
      @click="emit('import')"
    >
      <Upload :stroke-width="1.8" />
    </IconAction>
    <span class="flex shrink-0 items-center">
      <Button
        size="sm"
        variant="solid-fill"
        content-class-name="gap-1.5"
        class="rounded-r-none"
        @click="emit('create')"
      >
        <Plus :size="13" :stroke-width="2" aria-hidden="true" />
        New rule
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button
            size="sm"
            variant="solid-fill"
            square
            aria-label="New rule from a template"
            class="rounded-l-none border-l border-background/20"
          >
            <ChevronDown :size="13" :stroke-width="2" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-48">
          <DropdownMenuLabel>Start from</DropdownMenuLabel>
          <DropdownMenuItem
            v-for="template in DEFAULT_RULE_TEMPLATES"
            :key="template.label"
            @select="emit('create', template.rule)"
          >
            {{ template.label }}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  </div>
</template>
