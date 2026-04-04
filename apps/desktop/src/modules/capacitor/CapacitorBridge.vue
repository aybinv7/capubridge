<script setup lang="ts">
import { ref, computed } from "vue";
import {
  Search,
  ExternalLink,
  ArrowUpRight,
  ArrowDownLeft,
  AlertCircle,
  Clock,
  CheckCircle,
  XCircle,
} from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { mockBridgeCalls, type BridgeCall } from "@/data/mock-data";

const calls = ref<BridgeCall[]>(mockBridgeCalls);
const filter = ref("");
const pluginFilter = ref("All");
const statusFilter = ref("All");
const selectedCall = ref<BridgeCall | null>(null);

const plugins = ["All", ...Array.from(new Set(calls.value.map((c) => c.plugin)))];
const statuses = ["All", "resolved", "rejected", "pending"];

const filtered = computed(() =>
  calls.value.filter((c) => {
    if (pluginFilter.value !== "All" && c.plugin !== pluginFilter.value) return false;
    if (statusFilter.value !== "All" && c.status !== statusFilter.value) return false;
    if (filter.value) {
      const q = filter.value.toLowerCase();
      return (
        c.plugin.toLowerCase().includes(q) ||
        c.method.toLowerCase().includes(q) ||
        JSON.stringify(c.args).toLowerCase().includes(q)
      );
    }
    return true;
  }),
);

const stats = computed(() => ({
  total: calls.value.length,
  resolved: calls.value.filter((c) => c.status === "resolved").length,
  rejected: calls.value.filter((c) => c.status === "rejected").length,
  avgDuration: Math.round(calls.value.reduce((s, c) => s + c.duration, 0) / calls.value.length),
}));

function statusIcon(status: string) {
  if (status === "resolved") return CheckCircle;
  if (status === "rejected") return XCircle;
  return Clock;
}

function statusColor(status: string) {
  if (status === "resolved") return "text-success";
  if (status === "rejected") return "text-error";
  return "text-warning";
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <!-- Stats bar -->
    <div class="h-8 shrink-0 border-b border-border bg-accent flex items-center px-4 gap-4">
      <div class="flex items-center gap-1.5 text-2xs">
        <span class="text-muted-foreground">{{ stats.total }} calls</span>
        <span class="text-success">{{ stats.resolved }} ok</span>
        <span class="text-error">{{ stats.rejected }} err</span>
        <span class="text-muted-foreground">{{ stats.avgDuration }}ms avg</span>
      </div>
      <div class="flex-1" />
      <div class="flex items-center gap-0.5">
        <Button
          v-for="s in statuses"
          :key="s"
          :variant="statusFilter === s ? 'secondary' : 'ghost'"
          size="sm"
          class="h-5 px-2 text-2xs capitalize"
          :class="statusFilter === s ? '' : 'text-muted-foreground'"
          @click="statusFilter = s"
        >
          {{ s }}
        </Button>
      </div>
    </div>

    <!-- Filter bar -->
    <div class="h-8 shrink-0 border-b border-border bg-background flex items-center px-3 gap-2">
      <div
        class="flex items-center gap-1 bg-accent rounded-md px-2 py-0.5 max-w-xs border border-border"
      >
        <Search class="w-3 h-3 text-muted-foreground" />
        <Input
          v-model="filter"
          class="h-5 text-2xs font-mono bg-transparent border-0 focus-visible:ring-0 px-0 placeholder:text-muted-foreground"
          placeholder="Filter by plugin, method, args…"
        />
      </div>
      <div class="flex gap-0.5">
        <Button
          v-for="p in plugins"
          :key="p"
          :variant="pluginFilter === p ? 'secondary' : 'ghost'"
          size="sm"
          class="h-5 px-2 text-2xs"
          :class="pluginFilter === p ? '' : 'text-muted-foreground'"
          @click="pluginFilter = p"
        >
          {{ p }}
        </Button>
      </div>
    </div>

    <!-- Resizable panels: table | detail -->
    <ResizablePanelGroup direction="horizontal" class="flex-1">
      <ResizablePanel :default-size="75" :min-size="60">
        <div class="flex-1 overflow-auto h-full">
          <table class="w-full text-2xs">
            <thead class="sticky top-0 z-10">
              <tr
                class="bg-accent text-left text-muted-foreground uppercase tracking-wider border-b border-border"
              >
                <th class="px-3 py-2 font-medium w-4"></th>
                <th class="px-3 py-2 font-medium w-24">Plugin</th>
                <th class="px-3 py-2 font-medium w-28">Method</th>
                <th class="px-3 py-2 font-medium">Args</th>
                <th class="px-3 py-2 font-medium w-16">Time</th>
                <th class="px-3 py-2 font-medium w-12">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="call in filtered"
                :key="call.id"
                @click="selectedCall = selectedCall?.id === call.id ? null : call"
                class="border-b border-border cursor-pointer transition-colors group"
                :class="
                  selectedCall?.id === call.id
                    ? 'bg-secondary'
                    : call.status === 'rejected'
                      ? 'bg-error/[0.02]'
                      : 'data-row'
                "
              >
                <td class="px-3 py-2">
                  <component
                    :is="statusIcon(call.status)"
                    class="w-3 h-3"
                    :class="statusColor(call.status)"
                  />
                </td>
                <td class="px-3 py-2">
                  <Badge
                    variant="outline"
                    class="text-2xs font-mono border-border text-muted-foreground"
                  >
                    {{ call.plugin }}
                  </Badge>
                </td>
                <td class="px-3 py-2 font-mono text-xs text-foreground">{{ call.method }}</td>
                <td
                  class="px-3 py-2 font-mono text-xs text-muted-foreground truncate max-w-[250px]"
                >
                  {{ JSON.stringify(call.args) }}
                </td>
                <td
                  class="px-3 py-2 font-mono text-muted-foreground"
                  :class="call.duration > 500 ? 'text-warning' : ''"
                >
                  {{ call.duration }}ms
                </td>
                <td class="px-3 py-2">
                  <span class="text-2xs font-medium capitalize" :class="statusColor(call.status)">
                    {{ call.status }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </ResizablePanel>

      <ResizableHandle />
      <ResizablePanel :default-size="25" :min-size="20" :max-size="40">
        <div class="flex h-full flex-col border-l border-border bg-background">
          <template v-if="selectedCall">
            <div
              class="h-10 flex items-center justify-between px-3 border-b border-border shrink-0"
            >
              <div class="flex items-center gap-2">
                <Badge variant="outline" class="text-2xs font-mono border-border">{{
                  selectedCall.plugin
                }}</Badge>
                <span class="text-xs font-mono text-foreground">{{ selectedCall.method }}</span>
              </div>
              <div class="flex items-center gap-1">
                <Button variant="ghost" size="icon-sm" class="w-5 h-5 text-muted-foreground">
                  <ExternalLink class="w-3 h-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  class="w-5 h-5 text-muted-foreground"
                  @click="selectedCall = null"
                >
                  ✕
                </Button>
              </div>
            </div>

            <ScrollArea class="flex-1">
              <div class="p-3 space-y-3">
                <div class="flex items-center gap-2 text-2xs">
                  <component
                    :is="statusIcon(selectedCall.status)"
                    class="w-3 h-3"
                    :class="statusColor(selectedCall.status)"
                  />
                  <span class="font-medium capitalize" :class="statusColor(selectedCall.status)">{{
                    selectedCall.status
                  }}</span>
                  <span class="text-muted-foreground ml-auto">{{ selectedCall.duration }}ms</span>
                </div>

                <div>
                  <div
                    class="text-2xs text-muted-foreground mb-0.5 uppercase tracking-wider flex items-center gap-1"
                  >
                    <ArrowDownLeft class="w-3 h-3" /> Arguments
                  </div>
                  <pre
                    class="text-xs font-mono text-foreground bg-accent rounded-md p-2 border border-border overflow-x-auto whitespace-pre-wrap"
                    >{{ JSON.stringify(selectedCall.args, null, 2) }}</pre
                  >
                </div>

                <div v-if="selectedCall.result">
                  <div
                    class="text-2xs text-muted-foreground mb-0.5 uppercase tracking-wider flex items-center gap-1"
                  >
                    <ArrowUpRight class="w-3 h-3 text-success" /> Result
                  </div>
                  <pre
                    class="text-xs font-mono text-success bg-accent rounded-md p-2 border border-border overflow-x-auto whitespace-pre-wrap"
                    >{{ JSON.stringify(selectedCall.result, null, 2) }}</pre
                  >
                </div>

                <div v-if="selectedCall.error">
                  <div
                    class="text-2xs text-muted-foreground mb-0.5 uppercase tracking-wider flex items-center gap-1"
                  >
                    <AlertCircle class="w-3 h-3 text-error" /> Error
                  </div>
                  <pre
                    class="text-xs font-mono text-error bg-error/[0.03] rounded-md p-2 border border-error/10 overflow-x-auto whitespace-pre-wrap"
                    >{{ selectedCall.error }}</pre
                  >
                </div>

                <div class="text-2xs text-muted-foreground font-mono">
                  {{ selectedCall.timestamp }}
                </div>
              </div>
            </ScrollArea>
          </template>
          <template v-else>
            <div class="flex-1 flex items-center justify-center text-muted-foreground text-2xs">
              Select a call to view details
            </div>
          </template>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  </div>
</template>
