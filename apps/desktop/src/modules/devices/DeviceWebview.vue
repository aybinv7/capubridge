<script setup lang="ts">
import { Smartphone, Monitor, Zap, ExternalLink, Search } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { webviewTargets } from "@/data/mock-data";
</script>

<template>
  <div class="flex-1 overflow-y-auto p-4">
    <div class="max-w-2xl space-y-4">
      <div class="flex items-center gap-2 mb-1">
        <div class="w-1.5 h-1.5 rounded-full bg-foreground" />
        <span class="text-xs text-muted-foreground">Remote Targets — Chrome DevTools Protocol</span>
      </div>

      <div
        v-for="process in webviewTargets"
        :key="process.pid"
        class="bg-accent border border-border overflow-hidden"
      >
        <div class="flex items-center gap-3 px-3 py-2.5 bg-accent border-b border-border">
          <div
            class="w-7 h-7 rounded-lg bg-secondary border border-border flex items-center justify-center"
          >
            <Smartphone class="w-3.5 h-3.5 text-foreground" />
          </div>
          <div>
            <div class="text-xs font-medium text-foreground">{{ process.appLabel }}</div>
            <div class="text-2xs font-mono text-muted-foreground">
              {{ process.packageName }} · PID {{ process.pid }}
            </div>
          </div>
        </div>

        <div class="divide-y divide-border">
          <div
            v-for="target in process.targets"
            :key="target.id"
            class="flex items-center gap-3 px-3 py-2.5 hover:bg-accent transition-colors group"
          >
            <div
              class="w-5 h-5 rounded flex items-center justify-center shrink-0"
              :class="
                target.type === 'page' ? 'bg-info/10 text-info' : 'bg-warning/10 text-warning'
              "
            >
              <Monitor v-if="target.type === 'page'" class="w-3 h-3" />
              <Zap v-else class="w-3 h-3" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-xs font-medium text-foreground truncate">{{ target.title }}</div>
              <div class="text-2xs font-mono text-muted-foreground truncate mt-px">
                {{ target.url }}
              </div>
            </div>
            <span
              class="text-2xs text-muted-foreground px-1.5 py-0.5 rounded bg-secondary border border-border shrink-0"
            >
              {{ target.type === "page" ? "page" : "sw" }}
            </span>
            <Button
              variant="outline"
              size="sm"
              class="gap-1.5 bg-secondary text-foreground border-border hover:bg-secondary opacity-0 group-hover:opacity-100 transition-all shrink-0"
            >
              <ExternalLink class="w-2.5 h-2.5" />
              Inspect
            </Button>
          </div>
        </div>
      </div>

      <Button variant="ghost" size="sm" class="gap-2 text-muted-foreground">
        <Search class="w-3 h-3" />
        Refresh targets
      </Button>
    </div>
  </div>
</template>
