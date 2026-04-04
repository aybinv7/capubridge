<script setup lang="ts">
import { ref, computed } from "vue";
import { Search, X } from "lucide-vue-next";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { networkRequests } from "@/data/mock-data";

type DetailTab = "headers" | "payload" | "response" | "timing";

const selectedReq = ref<number | null>(null);
const detailTab = ref<DetailTab>("headers");

const selected = ref<(typeof networkRequests)[0] | undefined>(undefined);

function selectReq(id: number) {
  if (selectedReq.value === id) {
    selectedReq.value = null;
    selected.value = undefined;
  } else {
    selectedReq.value = id;
    selected.value = networkRequests.find((r) => r.id === id);
  }
}

function statusColor(status: number) {
  if (status === 101) return "text-foreground";
  if (status < 300) return "text-success";
  if (status < 400) return "text-info";
  if (status < 500) return "text-warning";
  return "text-error";
}

function methodBadge(method: string) {
  const map: Record<string, string> = {
    GET: "text-success bg-success/[0.08]",
    POST: "text-info bg-info/[0.08]",
    PUT: "text-warning bg-warning/[0.08]",
    DELETE: "text-error bg-error/[0.08]",
    WS: "text-foreground bg-secondary",
  };
  return map[method] || "text-muted-foreground bg-secondary";
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <!-- Resizable panels: table | detail -->
    <ResizablePanelGroup direction="horizontal" class="flex-1">
      <ResizablePanel :default-size="75" :min-size="60">
        <div class="h-full overflow-auto">
          <table class="w-full text-2xs">
            <thead class="sticky top-0 z-10">
              <tr
                class="bg-accent text-left text-muted-foreground uppercase tracking-wider border-b border-border"
              >
                <th class="px-3 py-2 font-medium">Method</th>
                <th class="px-3 py-2 font-medium w-[52px]">Status</th>
                <th class="px-3 py-2 font-medium">URL</th>
                <th class="px-3 py-2 font-medium w-14">Type</th>
                <th class="px-3 py-2 font-medium w-16 text-right">Size</th>
                <th class="px-3 py-2 font-medium w-16 text-right">Time</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="req in networkRequests"
                :key="req.id"
                @click="selectReq(req.id)"
                class="border-b border-border cursor-pointer transition-colors"
                :class="[
                  selectedReq === req.id ? 'bg-secondary' : 'data-row',
                  req.status >= 400 ? 'bg-error/[0.02]' : '',
                ]"
              >
                <td class="px-3 py-[7px]">
                  <span
                    class="text-2xs font-mono font-semibold px-1.5 py-[2px] rounded"
                    :class="methodBadge(req.method)"
                    >{{ req.method }}</span
                  >
                </td>
                <td class="px-3 py-[7px] font-mono font-medium" :class="statusColor(req.status)">
                  {{ req.status }}
                </td>
                <td
                  class="px-3 py-[7px] font-mono text-xs text-secondary-foreground truncate max-w-[350px]"
                >
                  {{ req.url.replace(/^https?:\/\//, "") }}
                </td>
                <td class="px-3 py-[7px] text-muted-foreground">{{ req.type }}</td>
                <td class="px-3 py-[7px] text-muted-foreground text-right font-mono">
                  {{ req.size }}
                </td>
                <td
                  class="px-3 py-[7px] text-right font-mono"
                  :class="
                    req.time.includes('s') && !req.time.includes('ms')
                      ? 'text-warning'
                      : 'text-muted-foreground'
                  "
                >
                  {{ req.time }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </ResizablePanel>

      <ResizableHandle />
      <ResizablePanel :default-size="25" :min-size="20" :max-size="40">
        <div class="flex h-full flex-col border-l border-border bg-background">
          <template v-if="selected">
            <div class="h-10 flex items-center px-3 border-b border-border shrink-0">
              <div class="flex items-center gap-1.5">
                <Button
                  v-for="t in ['headers', 'payload', 'response', 'timing'] as DetailTab[]"
                  :key="t"
                  :variant="detailTab === t ? 'secondary' : 'ghost'"
                  size="sm"
                  class="h-6 px-2 text-2xs capitalize"
                  :class="detailTab === t ? '' : 'text-muted-foreground'"
                  @click="detailTab = t"
                >
                  {{ t }}
                </Button>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                class="ml-auto text-muted-foreground"
                @click="
                  selectedReq = null;
                  selected = undefined;
                "
              >
                <X class="w-3 h-3" />
              </Button>
            </div>

            <ScrollArea class="flex-1">
              <div class="p-3 text-2xs">
                <div class="mb-4">
                  <div class="text-muted-foreground uppercase tracking-wider mb-2 font-medium">
                    General
                  </div>
                  <div class="space-y-2 font-mono">
                    <div>
                      <span class="text-muted-foreground block mb-0.5">URL</span>
                      <span class="text-foreground text-xs break-all leading-relaxed">{{
                        selected.url
                      }}</span>
                    </div>
                    <div
                      v-for="[label, val] in [
                        ['Method', selected.method],
                        ['Status', selected.status],
                        ['Initiator', selected.initiator],
                        ['Time', selected.time],
                      ]"
                      :key="String(label)"
                      class="flex justify-between items-center"
                    >
                      <span class="text-muted-foreground">{{ label }}</span>
                      <span
                        class="text-xs"
                        :class="
                          label === 'Status'
                            ? statusColor(Number(val))
                            : label === 'Initiator'
                              ? 'text-foreground'
                              : 'text-foreground'
                        "
                        >{{ val }}</span
                      >
                    </div>
                  </div>
                </div>

                <div>
                  <div class="text-muted-foreground uppercase tracking-wider mb-2 font-medium">
                    Response Headers
                  </div>
                  <div class="space-y-1.5 font-mono">
                    <div
                      v-for="[k, v] in [
                        ['content-type', 'application/json; charset=utf-8'],
                        ['cache-control', 'no-store, no-cache'],
                        ['x-request-id', 'a3f8c2e1-b421-4d89'],
                        ['x-response-time', '124ms'],
                        ['access-control-allow-origin', '*'],
                      ]"
                      :key="k"
                      class="flex gap-2"
                    >
                      <span class="text-info/50 shrink-0">{{ k }}</span>
                      <span class="text-secondary-foreground break-all">{{ v }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </template>
          <template v-else>
            <div class="flex-1 flex items-center justify-center text-muted-foreground text-2xs">
              Select a request to view details
            </div>
          </template>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  </div>
</template>
