<script setup lang="ts">
import { computed } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { Terminal } from "lucide-vue-next";
import { NavRail, NavRailItem, Tooltip } from "@capubridge/cladd";
import { primaryNavigationFeatures, utilityNavigationFeatures } from "@/app/feature-registry";
import { useUIStore } from "@/stores/ui.store";
import { useCommandsStore } from "@/stores/commands.store";
import { useDockStore } from "@/stores/dock.store";
import { bindingTokens } from "@/lib/commands/keymap";
import KeyCaps from "@/components/command/KeyCaps.vue";

const uiStore = useUIStore();
const commands = useCommandsStore();
const dockStore = useDockStore();
const route = useRoute();

const showLabels = computed(() => !uiStore.sidebarCollapsed);

function isActive(path: string) {
  return route.path.startsWith(path);
}

const commandBindings = computed(() => {
  const bindings = new Map<string, string>();
  for (const command of commands.commands) {
    if (command.binding) bindings.set(command.id, bindingTokens(command.binding));
  }
  return bindings;
});

function navBinding(featureId: string) {
  return commandBindings.value.get(`nav.${featureId}`) ?? "";
}

const dockBinding = computed(() => commandBindings.value.get("view.toggle-dock") ?? "");
</script>

<template>
  <NavRail aria-label="Main" :labels="showLabels">
    <Tooltip
      v-for="feature in primaryNavigationFeatures"
      :key="feature.id"
      position="bottom"
      :offset="8"
      content-class-name="flex items-center gap-2 px-2 py-1 text-xs"
    >
      <template #trigger>
        <NavRailItem
          :as="RouterLink"
          :to="feature.path"
          :label="feature.label"
          :active="isActive(feature.path)"
        >
          <template #icon>
            <component :is="feature.icon" :stroke-width="1.7" />
          </template>
        </NavRailItem>
      </template>
      <span>{{ feature.label }}</span>
      <span v-if="feature.maturity !== 'stable'" class="text-muted-foreground">
        {{ feature.maturity }}
      </span>
      <KeyCaps v-if="navBinding(feature.id)" :keys="navBinding(feature.id)" />
    </Tooltip>

    <template #footer>
      <Tooltip
        position="bottom"
        :offset="8"
        content-class-name="flex items-center gap-2 px-2 py-1 text-xs"
      >
        <template #trigger>
          <NavRailItem
            as="button"
            type="button"
            label="Console"
            hide-label
            :aria-pressed="dockStore.isOpen"
            :class="dockStore.isOpen && 'text-cladd-fg'"
            @click="dockStore.toggleDock()"
          >
            <template #icon>
              <Terminal :stroke-width="1.7" />
            </template>
            <template v-if="dockStore.hasUnread && !dockStore.isOpen" #indicator>
              <span class="size-1.5 rounded-full bg-signal-select" aria-hidden="true" />
            </template>
          </NavRailItem>
        </template>
        <span>{{ dockStore.isOpen ? "Hide console" : "Show console" }}</span>
        <KeyCaps v-if="dockBinding" :keys="dockBinding" />
      </Tooltip>

      <Tooltip
        v-for="feature in utilityNavigationFeatures"
        :key="feature.id"
        position="bottom"
        :offset="8"
        content-class-name="flex items-center gap-2 px-2 py-1 text-xs"
      >
        <template #trigger>
          <NavRailItem
            :as="RouterLink"
            :to="feature.path"
            :label="feature.label"
            :active="isActive(feature.path)"
            hide-label
          >
            <template #icon>
              <component :is="feature.icon" :stroke-width="1.7" />
            </template>
          </NavRailItem>
        </template>
        <span>{{ feature.label }}</span>
        <KeyCaps v-if="navBinding(feature.id)" :keys="navBinding(feature.id)" />
      </Tooltip>
    </template>
  </NavRail>
</template>
