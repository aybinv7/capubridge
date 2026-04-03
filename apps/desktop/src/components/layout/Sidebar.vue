<script setup lang="ts">
import { useRoute } from "vue-router";
import { Smartphone, Database, Globe, Terminal, Puzzle } from "lucide-vue-next";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const route = useRoute();

const navItems = [
  { to: "/devices", icon: Smartphone, label: "Devices" },
  { to: "/storage", icon: Database, label: "Storage" },
  { to: "/network", icon: Globe, label: "Network" },
  { to: "/console", icon: Terminal, label: "Console" },
  { to: "/hybrid", icon: Puzzle, label: "Hybrid" },
] as const;

function isActive(path: string) {
  return route.path.startsWith(path);
}
</script>

<template>
  <aside
    class="w-[52px] bg-surface-0 flex flex-col items-center pt-3 pb-2 shrink-0 border-r border-border/40"
  >
    <!-- Logo -->
    <div
      class="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10 flex items-center justify-center mb-5"
    >
      <span class="text-primary font-bold text-xs font-mono">DB</span>
    </div>

    <!-- Primary nav -->
    <nav class="flex flex-col items-center gap-0.5 flex-1">
      <Tooltip v-for="item in navItems" :key="item.to" :delay-duration="0">
        <TooltipTrigger as-child>
          <RouterLink
            :to="item.to"
            :aria-label="item.label"
            class="relative w-9 h-9 flex items-center justify-center rounded-lg transition-all duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            :class="
              isActive(item.to)
                ? 'text-primary'
                : 'text-muted-foreground hover:text-secondary-foreground'
            "
          >
            <!-- Active background + left pill indicator -->
            <template v-if="isActive(item.to)">
              <div class="absolute inset-0 rounded-lg bg-primary/[0.08] border border-primary/10" />
              <div
                class="absolute -left-[10px] top-1/2 -translate-y-1/2 w-[3px] h-4 bg-primary rounded-r-full"
              />
            </template>
            <component
              :is="item.icon"
              class="w-[17px] h-[17px] relative z-10"
              :stroke-width="isActive(item.to) ? 2 : 1.5"
            />
          </RouterLink>
        </TooltipTrigger>
        <TooltipContent
          side="right"
          :side-offset="12"
          class="bg-surface-3 border-border/60 text-foreground text-xs px-2.5 py-1.5 shadow-xl"
        >
          {{ item.label }}
        </TooltipContent>
      </Tooltip>
    </nav>

    <!-- Connection dot -->
    <div class="w-2 h-2 rounded-full bg-success glow-dot mt-2" title="Connected" />
  </aside>
</template>
