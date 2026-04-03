<script setup lang="ts">
import { ref } from "vue";
import { Search, Pause, Trash2, Download, X } from "lucide-vue-next";
import PanelHeader from "@/components/layout/PanelHeader.vue";
import { networkRequests } from "@/data/mock-data";

type DetailTab = "headers" | "payload" | "response" | "timing";

const selectedReq = ref<number | null>(null);
const detailTab = ref<DetailTab>("headers");
const filterText = ref("");
const typeFilter = ref("All");

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
  if (status === 101) return "text-primary";
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
    WS: "text-primary bg-primary/[0.08]",
  };
  return map[method] || "text-muted-foreground bg-surface-3";
}

const filteredRequests = ref(networkRequests);
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <PanelHeader title="Network Inspector" :subtitle="`${networkRequests.length} requests`" />

    <!-- Toolbar -->
    <div class="h-10 border-b border-border/20 bg-surface-1 flex items-center px-3 gap-2 shrink-0">
      <div
        class="flex items-center gap-1 bg-surface-2/60 rounded-md px-2 py-1 flex-1 max-w-xs border border-border/20 focus-within:border-primary/20 transition-colors"
      >
        <Search class="w-3 h-3 text-dimmed" />
        <input
          v-model="filterText"
          class="bg-transparent text-2xs text-foreground flex-1 outline-none placeholder:text-dimmed font-mono"
          placeholder="Filter by URL, method, status…"
        />
      </div>

      <div class="flex items-center gap-0.5 text-2xs">
        <button
          v-for="f in ['All', 'Fetch', 'WS', 'Doc', 'Img']"
          :key="f"
          @click="typeFilter = f"
          class="px-2 py-1 rounded-md transition-colors"
          :class="
            typeFilter === f
              ? 'bg-surface-3 text-foreground'
              : 'text-muted-foreground hover:text-secondary-foreground hover:bg-surface-2'
          "
        >
          {{ f }}
        </button>
      </div>

      <div class="flex-1" />

      <div class="flex items-center gap-0.5">
        <span class="text-2xs font-mono text-muted-foreground mr-2"
          >{{ networkRequests.length }} requests</span
        >
        <button
          v-for="(Icon, i) in [Pause, Trash2, Download]"
          :key="i"
          class="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-3 transition-colors"
        >
          <component :is="Icon" class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>

    <!-- Table + detail -->
    <div class="flex flex-1 overflow-hidden">
      <!-- Request list -->
      <div class="flex-1 overflow-auto">
        <table class="w-full text-2xs">
          <thead class="sticky top-0 z-10">
            <tr
              class="bg-surface-2/80 backdrop-blur-sm text-left text-dimmed uppercase tracking-wider border-b border-border/20"
            >
              <th class="px-3 py-2 font-medium w-[60px]">Method</th>
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
              class="border-b border-border/10 cursor-pointer transition-colors"
              :class="[
                selectedReq === req.id ? 'bg-primary/[0.04]' : 'data-row',
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
              <td class="px-3 py-[7px] text-dimmed">{{ req.type }}</td>
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

      <!-- Detail panel -->
      <Transition
        enter-active-class="transition-[width,opacity] duration-150 overflow-hidden"
        enter-from-class="w-0 opacity-0"
        enter-to-class="w-[320px] opacity-100"
        leave-active-class="transition-[width,opacity] duration-150 overflow-hidden"
        leave-from-class="w-[320px] opacity-100"
        leave-to-class="w-0 opacity-0"
      >
        <div
          v-if="selected"
          class="w-[320px] border-l border-border/30 bg-surface-1 shrink-0 flex flex-col"
        >
          <div class="h-10 flex items-center px-3 border-b border-border/20 shrink-0">
            <div class="flex items-center gap-1.5">
              <button
                v-for="t in ['headers', 'payload', 'response', 'timing'] as DetailTab[]"
                :key="t"
                @click="detailTab = t"
                class="px-2 py-1 text-2xs rounded-md capitalize transition-colors"
                :class="
                  detailTab === t
                    ? 'bg-surface-3 text-foreground'
                    : 'text-muted-foreground hover:text-secondary-foreground'
                "
              >
                {{ t }}
              </button>
            </div>
            <button
              @click="
                selectedReq = null;
                selected = undefined;
              "
              class="ml-auto p-1 rounded text-dimmed hover:text-foreground hover:bg-surface-3 transition-colors"
            >
              <X class="w-3 h-3" />
            </button>
          </div>

          <div class="flex-1 overflow-y-auto p-3 text-2xs">
            <!-- General -->
            <div class="mb-4">
              <div class="text-dimmed uppercase tracking-wider mb-2 font-medium">General</div>
              <div class="space-y-2 font-mono">
                <div>
                  <span class="text-dimmed block mb-0.5">URL</span>
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
                  <span class="text-dimmed">{{ label }}</span>
                  <span
                    class="text-xs"
                    :class="
                      label === 'Status'
                        ? statusColor(Number(val))
                        : label === 'Initiator'
                          ? 'text-primary/70'
                          : 'text-foreground'
                    "
                    >{{ val }}</span
                  >
                </div>
              </div>
            </div>

            <!-- Response headers -->
            <div>
              <div class="text-dimmed uppercase tracking-wider mb-2 font-medium">
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
        </div>
      </Transition>
    </div>
  </div>
</template>
