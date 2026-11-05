<script setup lang="ts">
import { CircleHelp, Upload } from "lucide-vue-next";
import { Segmented, SegmentedButton, StatusDot } from "@capubridge/cladd";
import HintTooltip from "@/shared/components/presentation/HintTooltip.vue";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import { SEGMENT_TEXT } from "@/shared/components/presentation/segmentText";
import type { MockInterceptMode, MockRule } from "@/types/mock.types";
import MockNewRuleButton from "./MockNewRuleButton.vue";
import MockServerControls from "./MockServerControls.vue";
import { MODES } from "./mockView";

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
</script>

<template>
  <div class="shrink-0 border-b border-border-subtle">
    <div class="flex flex-wrap items-center gap-x-2 gap-y-1.5 px-3 py-2">
      <span class="shrink-0 text-xs text-muted-foreground">Interception</span>
      <Segmented size="sm" active-variant="solid" aria-label="How requests are intercepted">
        <HintTooltip v-for="option in MODES" :key="option.value" :text="option.hint">
          <SegmentedButton
            :active="mode === option.value"
            content-class-name="gap-1.5"
            :class="SEGMENT_TEXT"
            @click="mode = option.value"
          >
            <StatusDot
              v-if="option.value !== 'off' && mode === option.value"
              color="cyan"
              size="xs"
            />
            {{ option.label }}
          </SegmentedButton>
        </HintTooltip>
      </Segmented>
      <span
        v-if="mode === 'cdp' && !props.hasTarget"
        class="shrink-0 text-xs text-warning"
        role="status"
      >
        Waiting for an app: choose one, or use the local server.
      </span>

      <span class="flex-1" />

      <HintTooltip :text="props.scope.detail">
        <span class="max-w-60 shrink truncate text-xs text-muted-foreground">
          {{ props.scope.label }}
        </span>
      </HintTooltip>
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
      <MockNewRuleButton @create="emit('create', $event)" />
    </div>
    <MockServerControls
      v-if="mode === 'http'"
      v-model:port="port"
      :server-running="props.serverRunning"
      :can-reverse="props.canReverse"
      :reversing="props.reversing"
      @reverse="emit('reverse')"
    />
  </div>
</template>
