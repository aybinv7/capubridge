<script setup lang="ts">
import { ref, useId } from "vue";
import { ChevronDown } from "lucide-vue-next";
import { Chip } from "@capubridge/cladd";
import CopyAction from "@/shared/components/presentation/CopyAction.vue";
import HintTooltip from "@/shared/components/presentation/HintTooltip.vue";
import type { Fact } from "./fact";

const props = defineProps<{ title: string; facts: readonly Fact[] }>();

const titleId = useId();
const opened = ref<ReadonlySet<string>>(new Set());

function toggle(key: string) {
  const next = new Set(opened.value);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  opened.value = next;
}
</script>

<template>
  <section class="flex flex-col gap-2" :aria-labelledby="titleId">
    <h2 :id="titleId" class="text-sm font-medium text-foreground">{{ props.title }}</h2>
    <dl class="flex flex-col divide-y divide-border-subtle">
      <div
        v-for="fact in props.facts"
        :key="fact.key"
        class="group/fact grid min-h-10 grid-cols-[9rem_1fr_auto] items-center gap-x-4 py-1.5"
      >
        <dt class="text-xs text-muted-foreground">{{ fact.label }}</dt>
        <dd class="flex min-w-0 flex-col gap-1">
          <span class="flex min-w-0 items-baseline gap-2">
            <HintTooltip :text="fact.hint ?? null">
              <span
                class="truncate"
                :class="[
                  fact.mono ? 'font-mono text-xs' : 'text-sm',
                  fact.quiet ? 'text-muted-foreground' : 'text-foreground',
                ]"
              >
                {{ fact.value }}
              </span>
            </HintTooltip>
            <span
              v-if="fact.detail && !fact.chips?.length"
              class="shrink-0 text-xs text-[var(--fg-subtle)]"
            >
              {{ fact.detail }}
            </span>
            <button
              v-if="fact.chips?.length"
              type="button"
              class="flex shrink-0 items-center gap-1 text-xs text-[var(--fg-subtle)] hover:text-foreground"
              :aria-expanded="opened.has(fact.key)"
              @click="toggle(fact.key)"
            >
              {{ fact.detail ?? `${fact.chips.length}` }}
              <ChevronDown
                :size="12"
                class="transition-transform duration-120"
                :class="opened.has(fact.key) && 'rotate-180'"
                aria-hidden="true"
              />
            </button>
          </span>
          <ul
            v-if="fact.chips?.length && opened.has(fact.key)"
            class="flex flex-wrap gap-1 pt-0.5"
            :aria-label="`${fact.label}: ${fact.detail ?? ''}`"
          >
            <li v-for="chip in fact.chips" :key="chip">
              <Chip size="xs" variant="transparent" class="font-mono text-muted-foreground">
                {{ chip }}
              </Chip>
            </li>
          </ul>
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
