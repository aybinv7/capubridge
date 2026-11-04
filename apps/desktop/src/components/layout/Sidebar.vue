<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { primaryNavigationFeatures, utilityNavigationFeatures } from "@/app/feature-registry";
import { useUIStore } from "@/stores/ui.store";

const uiStore = useUIStore();
const route = useRoute();

const isCollapsed = computed(() => uiStore.sidebarCollapsed);

function isActive(path: string) {
  return route.path.startsWith(path);
}

function shortcutFor(goKey: string | undefined) {
  return goKey ? `G ${goKey.toUpperCase()}` : null;
}
</script>

<template>
  <TooltipProvider :delay-duration="250">
    <nav
      aria-label="Primary"
      class="flex shrink-0 flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-chrome)] py-2 transition-[width] duration-200 ease-out"
      :class="isCollapsed ? 'w-12' : 'w-16'"
    >
      <ul class="flex flex-col gap-1 px-1.5">
        <li v-for="feature in primaryNavigationFeatures" :key="feature.id">
          <Tooltip>
            <TooltipTrigger as-child>
              <RouterLink
                :to="feature.path"
                :aria-current="isActive(feature.path) ? 'page' : undefined"
                class="relative flex flex-col items-center justify-center gap-1 rounded-md text-muted-foreground transition-colors duration-[120ms] hover:bg-[var(--bg-surface-raised)]/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ring)]"
                :class="[
                  isCollapsed ? 'h-9' : 'h-12',
                  isActive(feature.path) &&
                    'bg-[var(--bg-surface-raised)] text-foreground shadow-bevel',
                ]"
              >
                <span
                  v-if="isActive(feature.path)"
                  class="absolute -left-1.5 top-2 bottom-2 w-0.5 rounded-full bg-signal-select"
                />
                <component :is="feature.icon" :size="17" class="shrink-0" />
                <span v-if="!isCollapsed" class="max-w-full truncate px-0.5 text-2xs leading-none">
                  {{ feature.label }}
                </span>
              </RouterLink>
            </TooltipTrigger>
            <TooltipContent side="right" :side-offset="8" class="flex items-center gap-2">
              <span>{{ feature.label }}</span>
              <span v-if="feature.maturity !== 'stable'" class="text-muted-foreground">
                {{ feature.maturity }}
              </span>
              <kbd
                v-if="shortcutFor(feature.goKey)"
                class="rounded-sm bg-[var(--bg-surface-cut)] px-1 font-mono text-2xs text-muted-foreground shadow-cut"
                >{{ shortcutFor(feature.goKey) }}</kbd
              >
            </TooltipContent>
          </Tooltip>
        </li>
      </ul>

      <div class="min-h-2 flex-1" />

      <ul class="flex flex-col gap-1 px-1.5">
        <li v-for="feature in utilityNavigationFeatures" :key="feature.id">
          <Tooltip>
            <TooltipTrigger as-child>
              <RouterLink
                :to="feature.path"
                :aria-current="isActive(feature.path) ? 'page' : undefined"
                class="flex h-9 items-center justify-center rounded-md text-muted-foreground transition-colors duration-[120ms] hover:bg-[var(--bg-surface-raised)]/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ring)]"
                :class="isActive(feature.path) && 'bg-[var(--bg-surface-raised)] text-foreground'"
              >
                <component :is="feature.icon" :size="17" class="shrink-0" />
              </RouterLink>
            </TooltipTrigger>
            <TooltipContent side="right" :side-offset="8" class="flex items-center gap-2">
              <span>{{ feature.label }}</span>
              <kbd
                class="rounded-sm bg-[var(--bg-surface-cut)] px-1 font-mono text-2xs text-muted-foreground shadow-cut"
                >Ctrl+,</kbd
              >
            </TooltipContent>
          </Tooltip>
        </li>
      </ul>
    </nav>
  </TooltipProvider>
</template>
