<script setup lang="ts">
import CopyAction from "@/shared/components/presentation/CopyAction.vue";
import type { DeviceFact } from "./deviceFacts";

const props = defineProps<{ facts: readonly DeviceFact[] }>();
</script>

<template>
  <section class="flex flex-col gap-2" aria-labelledby="overview-facts-title">
    <h2 id="overview-facts-title" class="text-sm font-medium text-foreground">About this phone</h2>
    <dl class="flex flex-col divide-y divide-border-subtle">
      <div
        v-for="fact in props.facts"
        :key="fact.key"
        class="group/fact grid min-h-10 grid-cols-[9rem_1fr_auto] items-center gap-x-4 py-1.5"
      >
        <dt class="text-xs text-muted-foreground">{{ fact.label }}</dt>
        <dd class="flex min-w-0 flex-col gap-1">
          <span class="flex min-w-0 items-baseline gap-2">
            <span
              class="truncate"
              :class="[
                fact.mono ? 'font-mono text-xs' : 'text-sm',
                fact.quiet ? 'text-muted-foreground' : 'text-foreground',
              ]"
              :title="fact.value"
            >
              {{ fact.value }}
            </span>
            <span v-if="fact.detail" class="shrink-0 text-xs text-[var(--fg-subtle)]">
              {{ fact.detail }}
            </span>
          </span>
          <span
            v-if="fact.meter !== undefined"
            class="h-1 max-w-80 overflow-hidden rounded-full bg-surface-cut shadow-cut"
            role="meter"
            :aria-label="`${fact.label} used`"
            :aria-valuenow="Math.round(fact.meter)"
            aria-valuemin="0"
            aria-valuemax="100"
          >
            <span
              class="block h-full rounded-full"
              :class="fact.meter >= 90 ? 'bg-warning' : 'bg-muted-foreground'"
              :style="{ width: `${fact.meter}%` }"
            />
          </span>
        </dd>
        <div class="flex w-7 justify-end">
          <CopyAction
            v-if="fact.copy"
            :value="fact.copy"
            :label="`Copy ${fact.label.toLowerCase()}`"
            class="opacity-0 transition-opacity duration-120 group-hover/fact:opacity-100 focus-visible:opacity-100"
          />
        </div>
      </div>
    </dl>
  </section>
</template>
