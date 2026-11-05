<script setup lang="ts">
export interface OverviewStat {
  label: string;
  value: string;
  detail?: string;
}

export interface OverviewBarItem {
  id: string;
  label: string;
  value: number;
  display: string;
}

export interface OverviewBars {
  id: string;
  title: string;
  items: readonly OverviewBarItem[];
  empty: string;
}

/**
 * A source at a glance: a few numbers, the largest collections by two measures (each bar
 * opens its collection), then the tab's own list of collections.
 */
const props = defineProps<{
  stats: readonly OverviewStat[];
  bars: readonly OverviewBars[];
}>();

const emit = defineEmits<{ open: [id: string] }>();

defineSlots<{ default?: () => unknown }>();

function width(items: readonly OverviewBarItem[], value: number): string {
  const max = Math.max(1, ...items.map((item) => item.value));
  return `${Math.max(2, (value / max) * 100)}%`;
}
</script>

<template>
  <div class="@container min-h-0 flex-1 overflow-y-auto">
    <div class="flex flex-col gap-6 px-4 py-4">
      <dl class="grid grid-cols-2 gap-2 @2xl:grid-cols-4">
        <div
          v-for="stat in props.stats"
          :key="stat.label"
          class="flex flex-col gap-1 rounded-well bg-surface-cut px-3 py-2.5 shadow-cut"
        >
          <dt class="text-2xs text-muted-foreground">{{ stat.label }}</dt>
          <dd class="flex items-baseline gap-1.5">
            <span class="font-mono text-lg text-foreground tabular-nums">{{ stat.value }}</span>
            <span v-if="stat.detail" class="truncate text-2xs text-[var(--fg-subtle)]">
              {{ stat.detail }}
            </span>
          </dd>
        </div>
      </dl>

      <div class="grid grid-cols-1 gap-6 @3xl:grid-cols-2">
        <section v-for="chart in props.bars" :key="chart.id" class="flex min-w-0 flex-col gap-2">
          <h3 class="text-xs font-medium text-foreground">{{ chart.title }}</h3>
          <p v-if="chart.items.length === 0" class="text-xs text-muted-foreground">
            {{ chart.empty }}
          </p>
          <ol v-else class="flex flex-col gap-0.5">
            <li v-for="item in chart.items" :key="item.id">
              <button
                type="button"
                class="group/bar grid w-full grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3 rounded-control px-2 py-1 text-left hover:bg-cladd-surface-hover"
                @click="emit('open', item.id)"
              >
                <span class="truncate text-xs text-foreground/85">{{ item.label }}</span>
                <span class="h-1.5 overflow-hidden rounded-full bg-surface-cut shadow-cut">
                  <span
                    class="block h-full rounded-full bg-cat-storage/70 group-hover/bar:bg-cat-storage"
                    :style="{ width: width(chart.items, item.value) }"
                  />
                </span>
                <span class="font-mono text-2xs text-muted-foreground tabular-nums">
                  {{ item.display }}
                </span>
              </button>
            </li>
          </ol>
        </section>
      </div>

      <slot />
    </div>
  </div>
</template>
