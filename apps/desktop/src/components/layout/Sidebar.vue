<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import { Smartphone, Database, Globe, Zap, Crosshair, Settings } from "lucide-vue-next";
import {
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useUIStore } from "@/stores/ui.store";

const uiStore = useUIStore();
const route = useRoute();

const isCollapsed = computed(() => uiStore.sidebarCollapsed);

const navItems = [
  { to: "/devices", icon: Smartphone, label: "Devices" },
  { to: "/storage", icon: Database, label: "Storage" },
  { to: "/network", icon: Globe, label: "Network" },
  { to: "/capacitor", icon: Zap, label: "Capacitor" },
  { to: "/inspect", icon: Crosshair, label: "Inspect" },
] as const;

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
          <SidebarMenuItem v-for="item in navItems" :key="item.to" class="relative">
            <div
              v-if="isActive(item.to)"
              class="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-accent rounded-full z-10"
            />
            <Tooltip>
              <TooltipTrigger as-child>
                <RouterLink
                  :to="item.to"
                  class="flex items-center gap-3 w-full rounded-md px-3 py-2 text-sm transition-colors duration-[120ms] group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2"
                  :class="
                    isActive(item.to)
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                      : 'text-sidebar-foreground/55 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground'
                  "
                >
                  <component :is="item.icon" :size="16" class="shrink-0" />
                  <span class="group-data-[collapsible=icon]:hidden truncate">
                    {{ item.label }}
                  </span>
                </RouterLink>
              </TooltipTrigger>
              <TooltipContent v-if="isCollapsed" side="right" :side-offset="8">
                {{ item.label }}
              </TooltipContent>
            </Tooltip>
          </SidebarMenuItem>
        </SidebarMenu>

        <div class="flex-1 min-h-2" />

        <SidebarSeparator class="mx-0" />

        <SidebarMenu class="mt-1">
          <SidebarMenuItem class="relative">
            <div
              v-if="isActive('/settings')"
              class="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-accent rounded-full z-10"
            />
            <Tooltip>
              <TooltipTrigger as-child>
                <RouterLink
                  to="/settings"
                  class="flex items-center gap-3 w-full rounded-md px-3 py-2 text-sm transition-colors duration-[120ms] group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2"
                  :class="
                    isActive('/settings')
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                      : 'text-sidebar-foreground/55 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground'
                  "
                >
                  <Settings :size="16" class="shrink-0" />
                  <span class="group-data-[collapsible=icon]:hidden truncate">Settings</span>
                </RouterLink>
              </TooltipTrigger>
              <TooltipContent v-if="isCollapsed" side="right" :side-offset="8">
                Settings
              </TooltipContent>
            </Tooltip>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>
    </aside>
  </TooltipProvider>
</template>
