<script setup lang="ts">
import { Smartphone, Monitor, Zap, ExternalLink, Search } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { webviewTargets } from "@/data/mock-data";
</script>

<template>
  <div class="flex-1 overflow-y-auto p-8">
    <div class="max-w-3xl mx-auto space-y-6">
      <div class="flex items-center gap-2.5 mb-2">
        <div class="w-2 h-2 rounded-full bg-foreground" />
        <span class="text-sm text-muted-foreground">Remote Targets — Chrome DevTools Protocol</span>
      </div>

      <div
        v-for="process in webviewTargets"
        :key="process.pid"
        class="bg-surface-2 border border-border/30 rounded-lg overflow-hidden"
      >
        <div class="flex items-center gap-3 px-4 py-3 border-b border-border/30">
          <div
            class="w-9 h-9 rounded-lg bg-surface-3 border border-border/20 flex items-center justify-center"
          >
            <Smartphone class="w-4 h-4 text-foreground" />
          </div>
          <div>
            <div class="text-sm font-medium text-foreground">{{ process.appLabel }}</div>
            <div class="text-xs font-mono text-muted-foreground/50">
              {{ process.packageName }} · PID {{ process.pid }}
            </div>
          </div>
        </div>

        <div class="divide-y divide-border/20">
          <div
            v-for="target in process.targets"
            :key="target.id"
            class="flex items-center gap-3 px-4 py-3 hover:bg-surface-3/50 transition-colors group"
          >
            <div
              class="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
              :class="
                target.type === 'page' ? 'bg-info/10 text-info' : 'bg-warning/10 text-warning'
              "
            >
              <Monitor v-if="target.type === 'page'" class="w-3.5 h-3.5" />
              <Zap v-else class="w-3.5 h-3.5" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium text-foreground truncate">{{ target.title }}</div>
              <div class="text-xs font-mono text-muted-foreground/50 truncate mt-0.5">
                {{ target.url }}
              </div>
            </div>
            <span
              class="text-xs text-muted-foreground/50 px-2 py-0.5 rounded bg-surface-3 border border-border/20 shrink-0"
            >
              {{ target.type === "page" ? "page" : "sw" }}
            </span>
            <Button
              variant="outline"
              size="sm"
              class="gap-2 text-xs opacity-0 group-hover:opacity-100 transition-all shrink-0"
            >
              <ExternalLink class="w-3.5 h-3.5" />
              Inspect
            </Button>
          </div>
        </div>
      </div>

      <Button variant="ghost" size="sm" class="gap-2 text-muted-foreground/50 text-sm">
        <Search class="w-4 h-4" />
        Refresh targets
      </Button>
    </div>
  </div>
</template>
