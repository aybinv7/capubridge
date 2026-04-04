<script setup lang="ts">
import { ref, computed } from "vue";
import {
  Search,
  ExternalLink,
  AlertCircle,
  CheckCircle,
  AlertTriangle,
  Info,
} from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { mockCapacitorPlugins, mockAppInfo, type CapacitorPlugin } from "@/data/mock-data";

const plugins = ref<CapacitorPlugin[]>(mockCapacitorPlugins);
const filter = ref("");
const selectedPlugin = ref<CapacitorPlugin | null>(null);

const filtered = computed(() => {
  if (!filter.value) return plugins.value;
  const q = filter.value.toLowerCase();
  return plugins.value.filter(
    (p) => p.name.toLowerCase().includes(q) || p.package.toLowerCase().includes(q),
  );
});

const pluginStats = computed(() => ({
  total: plugins.value.length,
  native: plugins.value.filter((p) => p.native).length,
  outdated: plugins.value.filter((p) => p.status === "outdated").length,
  totalCalls: plugins.value.reduce((s, p) => s + p.calls, 0),
}));

function statusIcon(status: string) {
  if (status === "ok") return CheckCircle;
  if (status === "outdated") return Info;
  if (status === "warn") return AlertTriangle;
  return AlertCircle;
}

function statusColor(status: string) {
  if (status === "ok") return "text-success";
  if (status === "outdated") return "text-info";
  if (status === "warn") return "text-warning";
  return "text-error";
}

function statusLabel(status: string) {
  if (status === "ok") return "Ready";
  if (status === "outdated") return "Update Available";
  if (status === "warn") return "Config Issue";
  return "Error";
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <!-- Stats bar -->
    <div
      class="h-8 shrink-0 border-b border-border/20 bg-surface-2/30 flex items-center px-4 gap-4"
    >
      <div class="flex items-center gap-1.5 text-2xs">
        <span class="text-dimmed">{{ pluginStats.total }} plugins</span>
        <span class="text-muted-foreground">{{ pluginStats.native }} native</span>
        <span v-if="pluginStats.outdated > 0" class="text-info"
          >{{ pluginStats.outdated }} outdated</span
        >
        <span class="text-muted-foreground"
          >{{ pluginStats.totalCalls.toLocaleString() }} calls</span
        >
      </div>
    </div>

    <!-- Filter -->
    <div class="h-8 shrink-0 border-b border-border/20 bg-surface-1 flex items-center px-3 gap-2">
      <div
        class="flex items-center gap-1 bg-surface-2/60 rounded-md px-2 py-0.5 max-w-xs border border-border/20"
      >
        <Search class="w-3 h-3 text-dimmed" />
        <Input
          v-model="filter"
          class="h-5 text-2xs font-mono bg-transparent border-0 focus-visible:ring-0 px-0 placeholder:text-dimmed"
          placeholder="Filter plugins…"
        />
      </div>
    </div>

    <div class="flex flex-1 overflow-hidden">
      <!-- Resizable panels: table | detail -->
      <ResizablePanelGroup direction="horizontal" class="flex-1">
        <ResizablePanel :default-size="75" :min-size="60">
          <div class="flex-1 overflow-auto h-full">
            <table class="w-full text-2xs">
              <thead class="sticky top-0 z-10">
                <tr
                  class="bg-surface-2/80 backdrop-blur-sm text-left text-dimmed uppercase tracking-wider border-b border-border/20"
                >
                  <th class="px-3 py-2 font-medium">Plugin</th>
                  <th class="px-3 py-2 font-medium w-48">Package</th>
                  <th class="px-3 py-2 font-medium w-16">Version</th>
                  <th class="px-3 py-2 font-medium w-16">Calls</th>
                  <th class="px-3 py-2 font-medium w-24">Status</th>
                  <th class="px-3 py-2 font-medium w-16"></th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="plugin in filtered"
                  :key="plugin.name"
                  @click="selectedPlugin = selectedPlugin?.name === plugin.name ? null : plugin"
                  class="border-b border-border/10 cursor-pointer transition-colors group"
                  :class="selectedPlugin?.name === plugin.name ? 'bg-primary/[0.04]' : 'data-row'"
                >
                  <td class="px-3 py-2">
                    <div class="flex items-center gap-2">
                      <span class="text-xs font-medium text-foreground">{{ plugin.name }}</span>
                      <Badge
                        v-if="plugin.native"
                        variant="outline"
                        class="text-2xs border-border/20 text-dimmed"
                        >native</Badge
                      >
                    </div>
                  </td>
                  <td class="px-3 py-2 font-mono text-muted-foreground">{{ plugin.package }}</td>
                  <td class="px-3 py-2 font-mono text-muted-foreground">{{ plugin.version }}</td>
                  <td class="px-3 py-2 font-mono text-dimmed">
                    {{ plugin.calls.toLocaleString() }}
                  </td>
                  <td class="px-3 py-2">
                    <div class="flex items-center gap-1">
                      <component
                        :is="statusIcon(plugin.status)"
                        class="w-3 h-3"
                        :class="statusColor(plugin.status)"
                      />
                      <span
                        class="text-2xs font-medium capitalize"
                        :class="statusColor(plugin.status)"
                      >
                        {{ statusLabel(plugin.status) }}
                      </span>
                    </div>
                  </td>
                  <td class="px-3 py-2">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      class="w-5 h-5 text-dimmed opacity-0 group-hover:opacity-100"
                      @click.stop
                    >
                      <ExternalLink class="w-3 h-3" />
                    </Button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </ResizablePanel>

        <ResizableHandle />
        <ResizablePanel :default-size="25" :min-size="20" :max-size="40">
          <div class="flex h-full flex-col border-l border-border/30 bg-surface-1">
            <template v-if="selectedPlugin">
              <div
                class="h-10 flex items-center justify-between px-3 border-b border-border/20 shrink-0"
              >
                <span class="text-xs font-medium text-foreground">{{ selectedPlugin.name }}</span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  class="w-5 h-5 text-dimmed"
                  @click="selectedPlugin = null"
                  >✕</Button
                >
              </div>
              <ScrollArea class="flex-1">
                <div class="p-3 space-y-3">
                  <div class="space-y-2">
                    <div class="text-2xs text-muted-foreground">Package</div>
                    <div
                      class="text-xs font-mono text-foreground bg-surface-2/50 rounded-md px-2 py-1.5 border border-border/10 break-all"
                    >
                      {{ selectedPlugin.package }}
                    </div>
                  </div>
                  <div class="grid grid-cols-2 gap-2">
                    <div class="bg-surface-2/50 rounded-md p-2 border border-border/10">
                      <div class="text-2xs text-dimmed">Version</div>
                      <div class="text-xs font-mono text-foreground">
                        {{ selectedPlugin.version }}
                      </div>
                    </div>
                    <div class="bg-surface-2/50 rounded-md p-2 border border-border/10">
                      <div class="text-2xs text-dimmed">Calls</div>
                      <div class="text-xs font-mono text-foreground">
                        {{ selectedPlugin.calls.toLocaleString() }}
                      </div>
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <component
                      :is="statusIcon(selectedPlugin.status)"
                      class="w-3 h-3"
                      :class="statusColor(selectedPlugin.status)"
                    />
                    <span class="text-xs font-medium" :class="statusColor(selectedPlugin.status)">{{
                      statusLabel(selectedPlugin.status)
                    }}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    class="w-full gap-1.5 text-2xs"
                    as="a"
                    :href="selectedPlugin.docsUrl"
                    target="_blank"
                  >
                    <ExternalLink class="w-3 h-3" />
                    View Documentation
                  </Button>
                </div>
              </ScrollArea>
            </template>
            <template v-else>
              <div class="flex-1 flex items-center justify-center text-dimmed text-2xs">
                Select a plugin to view details
              </div>
            </template>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  </div>
</template>
