<script setup lang="ts">
import { useRoute } from "vue-router";
import { Smartphone, Database, Globe, Terminal, Zap, Settings, Crosshair } from "lucide-vue-next";

const route = useRoute();

const navItems = [
  { to: "/devices", icon: Smartphone, label: "Devices" },
  { to: "/storage", icon: Database, label: "Storage" },
  { to: "/network", icon: Globe, label: "Network" },
  { to: "/console", icon: Terminal, label: "Console" },
  { to: "/capacitor", icon: Zap, label: "Capacitor" },
  { to: "/inspect", icon: Crosshair, label: "Inspect" },
] as const;

const bottomItems = [{ to: "/settings", icon: Settings, label: "Settings" }] as const;

function isActive(path: string) {
  return route.path.startsWith(path);
}
</script>

<template>
  <aside class="w-18 bg-background flex flex-col shrink-0 pt-2">
    <!-- Primary nav -->
    <nav class="flex flex-col gap-0.5 px-2 flex-1">
      <RouterLink
        v-for="item in navItems"
        :key="item.to"
        :to="item.to"
        :aria-label="item.label"
        class="relative flex flex-col items-center gap-1 py-2 transition-colors duration-150"
        :class="
          isActive(item.to) ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
        "
      >
        <!-- Active indicator -->
        <div
          v-if="isActive(item.to)"
          class="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-foreground"
        />
        <div v-if="isActive(item.to)" class="absolute inset-0 rounded-lg bg-secondary" />
        <component
          :is="item.icon"
          class="w-4 h-4 relative z-10"
          :stroke-width="isActive(item.to) ? 2 : 1.5"
        />
        <span class="text-[9px] relative z-10" :class="isActive(item.to) ? 'font-medium' : ''">
          {{ item.label }}
        </span>
      </RouterLink>
    </nav>

    <!-- Bottom nav -->
    <nav class="flex flex-col gap-0.5 px-2">
      <RouterLink
        v-for="item in bottomItems"
        :key="item.to"
        :to="item.to"
        :aria-label="item.label"
        class="relative flex flex-col items-center gap-1 py-2 transition-colors duration-150"
        :class="
          isActive(item.to) ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
        "
      >
        <div
          v-if="isActive(item.to)"
          class="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-foreground"
        />
        <div v-if="isActive(item.to)" class="absolute inset-0 bg-secondary" />
        <component
          :is="item.icon"
          class="w-4 h-4 relative z-10"
          :stroke-width="isActive(item.to) ? 2 : 1.5"
        />
        <span class="text-[9px] relative z-10" :class="isActive(item.to) ? 'font-medium' : ''">
          {{ item.label }}
        </span>
      </RouterLink>
    </nav>
  </aside>
</template>
