<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import {
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { primaryNavigationFeatures, utilityNavigationFeatures } from "@/app/feature-registry";
import { useUIStore } from "@/stores/ui.store";

const uiStore = useUIStore();
const route = useRoute();

const isCollapsed = computed(() => uiStore.sidebarCollapsed);

function isActive(path: string) {
  return route.path.startsWith(path);
}
</script>

<template>
  <TooltipProvider :delay-duration="300">
    <aside
      class="group bg-sidebar text-sidebar-foreground flex flex-col shrink-0 border-r border-sidebar-border transition-[width] duration-200 ease-linear overflow-hidden"
      :class="isCollapsed ? 'w-14' : 'w-50'"
      :data-state="isCollapsed ? 'collapsed' : 'expanded'"
      :data-collapsible="isCollapsed ? 'icon' : ''"
    >
      <SidebarContent class="px-2 py-2">
        <SidebarMenu>
          <SidebarMenuItem
            v-for="feature in primaryNavigationFeatures"
            :key="feature.id"
            class="relative"
          >
            <div
              v-if="isActive(feature.path)"
              class="absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-brand rounded-full z-10"
            />
            <Tooltip>
              <TooltipTrigger as-child>
                <RouterLink
                  :to="feature.path"
                  class="flex items-center gap-3 w-full rounded-md px-3 py-2 text-sm transition-colors duration-[120ms] group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2"
                  :class="
                    isActive(feature.path)
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                      : 'text-sidebar-foreground/55 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground'
                  "
                >
                  <component :is="feature.icon" :size="16" class="shrink-0" />
                  <span class="group-data-[collapsible=icon]:hidden min-w-0 flex-1 truncate">
                    {{ feature.label }}
                  </span>
                  <span
                    v-if="feature.maturity !== 'stable'"
                    class="group-data-[collapsible=icon]:hidden rounded-full border border-border/40 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground/65"
                  >
                    {{ feature.maturity }}
                  </span>
                </RouterLink>
              </TooltipTrigger>
              <TooltipContent v-if="isCollapsed" side="right" :side-offset="8">
                {{ feature.label }} · {{ feature.maturity }}
              </TooltipContent>
            </Tooltip>
          </SidebarMenuItem>
        </SidebarMenu>

        <div class="flex-1 min-h-2" />

        <SidebarSeparator class="mx-0" />

        <SidebarMenu class="mt-1">
          <SidebarMenuItem
            v-for="feature in utilityNavigationFeatures"
            :key="feature.id"
            class="relative"
          >
            <div
              v-if="isActive(feature.path)"
              class="absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-brand rounded-full z-10"
            />
            <Tooltip>
              <TooltipTrigger as-child>
                <RouterLink
                  :to="feature.path"
                  class="flex items-center gap-3 w-full rounded-md px-3 py-2 text-sm transition-colors duration-[120ms] group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2"
                  :class="
                    isActive(feature.path)
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                      : 'text-sidebar-foreground/55 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground'
                  "
                >
                  <component :is="feature.icon" :size="16" class="shrink-0" />
                  <span class="group-data-[collapsible=icon]:hidden truncate">
                    {{ feature.label }}
                  </span>
                </RouterLink>
              </TooltipTrigger>
              <TooltipContent v-if="isCollapsed" side="right" :side-offset="8">
                {{ feature.label }}
              </TooltipContent>
            </Tooltip>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>
    </aside>
  </TooltipProvider>
</template>
