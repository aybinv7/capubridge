<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  Smartphone,
  Film,
  AppWindow,
  Settings as SettingsIcon,
  ChevronRight,
  Database,
  Globe,
  Crosshair,
  MonitorPlay,
  Wrench,
} from "lucide-vue-next";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useUIStore } from "@/stores/ui.store";
import { useDevicesStore } from "@/stores/devices.store";

const uiStore = useUIStore();
const devicesStore = useDevicesStore();
const route = useRoute();
const router = useRouter();

const isCollapsed = computed(() => uiStore.sidebarCollapsed);

const targets = computed(() => devicesStore.devices);

const singletons = [
  { to: "/browser-preview", icon: AppWindow, label: "Browser Preview" },
  { to: "/settings", icon: SettingsIcon, label: "Settings" },
] as const;

const tools = [
  { to: "/devices", icon: Smartphone, label: "Devices" },
  { to: "/app", icon: AppWindow, label: "App" },
  { to: "/storage", icon: Database, label: "Storage" },
  { to: "/network", icon: Globe, label: "Network" },
  { to: "/inspect", icon: Crosshair, label: "Inspect" },
  { to: "/replay", icon: MonitorPlay, label: "Replay" },
] as const;

const toolsOpen = ref(true);

function isActive(path: string): boolean {
  return route.path === path || route.path.startsWith(path + "/");
}

function statusDotClass(status: string): string {
  if (status === "online") return "bg-[var(--state-success)]";
  if (status === "unauthorized") return "bg-[var(--state-warning)]";
  return "bg-[var(--fg-subtle)]";
}

function openTarget(serial: string) {
  // Slice 2 stub: select the device + navigate to the devices module.
  // Slice 3 will open a tab for the (tool, target) pair instead.
  const device = devicesStore.devices.find((d) => d.serial === serial);
  if (device) void devicesStore.selectDevice(device);
  void router.push("/devices/overview");
}
</script>

<template>
  <TooltipProvider :delay-duration="300">
    <aside
      class="group flex shrink-0 flex-col overflow-hidden border-r border-[var(--border-subtle)] bg-[var(--bg-chrome)] text-[var(--fg-default)] transition-[width] duration-200 ease-linear"
      :class="isCollapsed ? 'w-14' : 'w-[220px]'"
      :data-state="isCollapsed ? 'collapsed' : 'expanded'"
      :data-collapsible="isCollapsed ? 'icon' : ''"
    >
      <div class="flex-1 overflow-y-auto px-2 py-2">
        <!-- Targets -->
        <div class="mb-1">
          <div
            v-if="!isCollapsed"
            class="px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-[var(--fg-subtle)]"
          >
            Targets
          </div>
          <ul v-if="targets.length > 0">
            <li v-for="t in targets" :key="t.serial">
              <Tooltip>
                <TooltipTrigger as-child>
                  <button
                    type="button"
                    class="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors duration-150 hover:bg-[var(--bg-surface-raised)] group-data-[collapsible=icon]:justify-center"
                    @click="openTarget(t.serial)"
                  >
                    <Smartphone :size="14" class="shrink-0 text-[var(--fg-muted)]" />
                    <span
                      class="size-1.5 shrink-0 rounded-full group-data-[collapsible=icon]:hidden"
                      :class="statusDotClass(t.status)"
                    />
                    <span
                      class="truncate text-[var(--fg-default)] group-data-[collapsible=icon]:hidden"
                    >
                      {{ t.model ?? t.serial }}
                    </span>
                  </button>
                </TooltipTrigger>
                <TooltipContent v-if="isCollapsed" side="right" :side-offset="8">
                  {{ t.model ?? t.serial }}
                </TooltipContent>
              </Tooltip>
            </li>
          </ul>
          <p v-else-if="!isCollapsed" class="px-2.5 py-1 text-xs italic text-[var(--fg-subtle)]">
            No devices connected
          </p>
        </div>

        <!-- Recordings (stub for slice 2) -->
        <div class="mb-1">
          <div
            v-if="!isCollapsed"
            class="px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-[var(--fg-subtle)]"
          >
            Recordings
          </div>
          <p v-if="!isCollapsed" class="px-2.5 py-1 text-xs italic text-[var(--fg-subtle)]">
            No recordings yet
          </p>
          <div v-else class="flex justify-center py-1">
            <Tooltip>
              <TooltipTrigger as-child>
                <span class="text-[var(--fg-subtle)]"><Film :size="14" /></span>
              </TooltipTrigger>
              <TooltipContent side="right" :side-offset="8">Recordings</TooltipContent>
            </Tooltip>
          </div>
        </div>

        <!-- Singletons -->
        <ul class="mb-2 mt-1">
          <li v-for="item in singletons" :key="item.to" class="relative">
            <div
              v-if="isActive(item.to)"
              class="absolute left-0 top-1.5 bottom-1.5 z-10 w-0.5 rounded-full bg-[var(--accent)]"
            />
            <Tooltip>
              <TooltipTrigger as-child>
                <RouterLink
                  :to="item.to"
                  class="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors duration-150 group-data-[collapsible=icon]:justify-center"
                  :class="
                    isActive(item.to)
                      ? 'bg-[var(--bg-surface-raised)] font-medium text-[var(--fg-default)]'
                      : 'text-[var(--fg-muted)] hover:bg-[var(--bg-surface-raised)] hover:text-[var(--fg-default)]'
                  "
                >
                  <component :is="item.icon" :size="14" class="shrink-0" />
                  <span class="truncate group-data-[collapsible=icon]:hidden">
                    {{ item.label }}
                  </span>
                </RouterLink>
              </TooltipTrigger>
              <TooltipContent v-if="isCollapsed" side="right" :side-offset="8">
                {{ item.label }}
              </TooltipContent>
            </Tooltip>
          </li>
        </ul>

        <!-- Tools (legacy module nav — temporary during slice 2/3) -->
        <div v-if="!isCollapsed" class="mt-3 border-t border-[var(--border-subtle)] pt-2">
          <button
            type="button"
            class="flex w-full items-center gap-2 rounded-md px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-[var(--fg-subtle)] hover:text-[var(--fg-muted)]"
            @click="toolsOpen = !toolsOpen"
          >
            <ChevronRight
              :size="10"
              class="transition-transform duration-150"
              :class="toolsOpen ? 'rotate-90' : ''"
            />
            <Wrench :size="10" />
            <span>Tools</span>
          </button>
          <ul v-if="toolsOpen" class="mt-1">
            <li v-for="item in tools" :key="item.to" class="relative">
              <div
                v-if="isActive(item.to)"
                class="absolute left-0 top-1.5 bottom-1.5 z-10 w-0.5 rounded-full bg-[var(--accent)]"
              />
              <RouterLink
                :to="item.to"
                class="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors duration-150"
                :class="
                  isActive(item.to)
                    ? 'bg-[var(--bg-surface-raised)] font-medium text-[var(--fg-default)]'
                    : 'text-[var(--fg-muted)] hover:bg-[var(--bg-surface-raised)] hover:text-[var(--fg-default)]'
                "
              >
                <component :is="item.icon" :size="14" class="shrink-0" />
                <span class="truncate">{{ item.label }}</span>
              </RouterLink>
            </li>
          </ul>
        </div>
      </div>
    </aside>
  </TooltipProvider>
</template>
