<script setup lang="ts">
import { computed } from "vue";
import { Check, CircleX, Copy, TriangleAlert } from "lucide-vue-next";
import { Button, Spinner } from "@capubridge/cladd";
import { toast } from "@/lib/toast";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import GateDiagram from "@/components/gate/GateDiagram.vue";
import GateActions from "@/components/gate/GateActions.vue";
import { useActiveContextStore } from "@/stores/activeContext.store";
import { useCommandsStore } from "@/stores/commands.store";
import { useGateActions } from "@/composables/useGateActions";
import { buildChain } from "@/lib/gates/chain";
import { gateCopy } from "@/lib/gates/copy";
import type { GateKind, GateRequirement } from "@/lib/gates/types";

const props = withDefaults(
  defineProps<{
    requirement: GateRequirement;
    kind: Exclude<GateKind, "open">;
    density?: "full" | "compact";
    secondary?: { commandId: string; label: string; hint?: string };
  }>(),
  { density: "full" },
);

const context = useActiveContextStore();
const commands = useCommandsStore();
const { run, running } = useGateActions();

const secondaryCommand = computed(() =>
  props.secondary
    ? (commands.commands.find((command) => command.id === props.secondary?.commandId) ?? null)
    : null,
);

function runSecondary() {
  if (secondaryCommand.value) void commands.run(secondaryCommand.value);
}

const content = computed(() => gateCopy(props.kind, context.gateInput, props.requirement));
const chain = computed(() => buildChain(props.requirement, context.gateInput));
const errorDetail = computed(() => (props.kind === "error" ? context.gateInput.linkError : null));

const watchLine = computed(() => {
  if (props.kind !== "no-device" || context.gateInput.onlineDevices > 0) return null;
  switch (context.gateInput.adb) {
    case "running":
      return "Watching for devices over ADB";
    case "starting":
      return "Starting the ADB server";
    case "unknown":
      return "Checking the ADB server";
    case "error":
      return null;
  }
});

async function copyDetail() {
  if (!errorDetail.value) return;
  try {
    await navigator.clipboard.writeText(errorDetail.value);
    toast.success("Error copied");
  } catch (error) {
    toast.error("Could not copy the error", { description: String(error) });
  }
}
</script>

<template>
  <div
    v-if="density === 'compact'"
    class="flex h-full min-h-0 items-center justify-center px-4"
    role="status"
    aria-live="polite"
    :data-gate="kind"
  >
    <div class="flex min-w-0 max-w-2xl items-center gap-3">
      <Spinner v-if="content.tone === 'waiting'" size="xs" color="yellow" />
      <TriangleAlert
        v-else-if="content.tone === 'warning'"
        :size="14"
        class="shrink-0 text-warning"
      />
      <CircleX v-else-if="content.tone === 'error'" :size="14" class="shrink-0 text-error" />
      <div class="min-w-0">
        <p class="truncate text-xs font-medium text-foreground">{{ content.title }}</p>
        <p class="truncate text-2xs text-muted-foreground">{{ content.detail }}</p>
      </div>
      <GateActions
        v-if="content.actions.length"
        :actions="content.actions"
        :running="running"
        :limit="1"
        class="shrink-0"
        @run="run"
      />
    </div>
  </div>

  <div v-else class="h-full min-h-0 overflow-auto" :data-gate="kind">
    <Empty
      class="mx-auto w-full max-w-2xl flex-none items-center justify-start gap-6 rounded-none border-0 px-8 pt-[11vh] pb-8 text-center md:px-8 md:pt-[11vh]"
      role="status"
      aria-live="polite"
    >
      <GateDiagram v-if="chain.length" :links="chain" class="max-w-full" />

      <EmptyHeader class="max-w-none items-center gap-1.5 text-center">
        <EmptyTitle
          class="flex items-center justify-center gap-2 text-lg font-medium text-foreground"
        >
          <Spinner v-if="content.tone === 'waiting'" size="sm" color="yellow" />
          <TriangleAlert v-else-if="content.tone === 'warning'" :size="16" class="text-warning" />
          <CircleX v-else-if="content.tone === 'error'" :size="16" class="text-error" />
          {{ content.title }}
        </EmptyTitle>
        <EmptyDescription class="max-w-md text-sm text-balance text-muted-foreground">
          {{ content.detail }}
        </EmptyDescription>
      </EmptyHeader>

      <ol
        v-if="content.steps"
        class="flex w-full max-w-md flex-col gap-2.5 rounded-surface bg-surface-cut p-4 text-left shadow-cut"
        aria-label="Steps"
      >
        <li
          v-for="(step, index) in content.steps"
          :key="step"
          class="flex items-baseline gap-3 text-sm text-foreground"
        >
          <span class="w-5 shrink-0 font-mono text-2xs text-[var(--fg-subtle)]">
            {{ String(index + 1).padStart(2, "0") }}
          </span>
          {{ step }}
        </li>
        <li
          v-if="watchLine"
          class="flex items-center gap-3 font-mono text-2xs text-muted-foreground"
          data-gate-watch
        >
          <span class="flex w-5 shrink-0 justify-center">
            <span class="size-1.5 rounded-full ring-1 ring-inset ring-warning" aria-hidden="true" />
          </span>
          {{ watchLine }}
        </li>
      </ol>

      <div
        v-if="errorDetail"
        class="flex items-start gap-2 rounded-md bg-surface-cut p-2.5 shadow-cut"
      >
        <code
          class="min-w-0 flex-1 font-mono text-2xs break-words whitespace-pre-wrap text-error select-text"
        >
          {{ errorDetail }}
        </code>
        <Button
          size="xs"
          square
          variant="transparent"
          :outline="false"
          aria-label="Copy error"
          @click="copyDetail"
        >
          <Copy :size="12" aria-hidden="true" />
        </Button>
      </div>

      <EmptyContent v-if="content.actions.length" class="max-w-none items-center">
        <GateActions :actions="content.actions" :running="running" @run="run" />
      </EmptyContent>
      <p
        v-else-if="content.tone === 'waiting'"
        class="flex items-center gap-2 font-mono text-2xs text-muted-foreground"
      >
        <Check :size="12" class="text-[var(--fg-subtle)]" />
        Nothing to do. This screen opens by itself.
      </p>
      <p
        v-if="secondary && secondaryCommand"
        class="flex items-center gap-2 text-xs text-muted-foreground"
        data-gate-secondary
      >
        <span>{{ secondary.hint ?? "Or" }}</span>
        <Button size="sm" variant="transparent" @click="runSecondary">
          {{ secondary.label }}
        </Button>
      </p>
    </Empty>
  </div>
</template>
