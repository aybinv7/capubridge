<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import { Tooltip } from "@capubridge/cladd";
import { primaryNavigationFeatures, utilityNavigationFeatures } from "@/app/feature-registry";
import { useUIStore } from "@/stores/ui.store";
import { useCommandsStore } from "@/stores/commands.store";
import { bindingTokens } from "@/lib/commands/keymap";
import KeyCaps from "@/components/command/KeyCaps.vue";

const uiStore = useUIStore();
const commands = useCommandsStore();
const route = useRoute();

const isCollapsed = computed(() => uiStore.sidebarCollapsed);

function isActive(path: string) {
  return route.path.startsWith(path);
}

const navBindings = computed(() => {
  const bindings = new Map<string, string>();
  for (const command of commands.commands) {
    if (command.id.startsWith("nav.") && command.binding) {
      bindings.set(command.id.slice(4), bindingTokens(command.binding));
    }
  }
  return bindings;
});
</script>

<template>
  <nav
    aria-label="Primary"
    class="flex shrink-0 flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-chrome)] py-2 transition-[width] duration-200 ease-out"
    :class="isCollapsed ? 'w-12' : 'w-16'"
  >
    <ul class="flex flex-col gap-1 px-1.5">
      <li v-for="feature in primaryNavigationFeatures" :key="feature.id">
        <Tooltip
          position="right"
          :offset="8"
          content-class-name="flex items-center gap-2 px-2 py-1 text-xs"
        >
          <template #trigger>
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
          </template>
          <span>{{ feature.label }}</span>
          <span v-if="feature.maturity !== 'stable'" class="text-muted-foreground">
            {{ feature.maturity }}
          </span>
          <KeyCaps v-if="navBindings.get(feature.id)" :keys="navBindings.get(feature.id) ?? ''" />
        </Tooltip>
      </li>
    </ul>

    <div class="min-h-2 flex-1" />

    <ul class="flex flex-col gap-1 px-1.5">
      <li v-for="feature in utilityNavigationFeatures" :key="feature.id">
        <Tooltip
          position="right"
          :offset="8"
          content-class-name="flex items-center gap-2 px-2 py-1 text-xs"
        >
          <template #trigger>
            <RouterLink
              :to="feature.path"
              :aria-current="isActive(feature.path) ? 'page' : undefined"
              class="flex h-9 items-center justify-center rounded-md text-muted-foreground transition-colors duration-[120ms] hover:bg-[var(--bg-surface-raised)]/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ring)]"
              :class="isActive(feature.path) && 'bg-[var(--bg-surface-raised)] text-foreground'"
            >
              <component :is="feature.icon" :size="17" class="shrink-0" />
            </RouterLink>
          </template>
          <span>{{ feature.label }}</span>
          <KeyCaps v-if="navBindings.get(feature.id)" :keys="navBindings.get(feature.id) ?? ''" />
        </Tooltip>
      </li>
    </ul>
  </nav>
</template>
