<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { watchDebounced } from "@vueuse/core";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Clock,
  Copy,
  FilePlus,
  Globe,
  Plus,
  Radio,
  Server,
  Trash2,
  X,
  Zap,
} from "lucide-vue-next";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { invokeCommand } from "@/runtime/ipc/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useMockStore } from "@/modules/network/stores/useMockStore";
import { useMockServer } from "@/composables/useMockServer";
import { useTargetsStore } from "@/stores/targets.store";
import type { MockRule, MockInterceptMode, MockResponseHeader } from "@/types/mock.types";
import { DEFAULT_RULE_TEMPLATES } from "@/types/mock.types";
import { useFixedVirtualList } from "@/shared/composables/useFixedVirtualList";

useMockServer();

const store = useMockStore();
const targetsStore = useTargetsStore();
const hasTarget = computed(() => !!targetsStore.selectedTarget?.id);

// Selected rule + draft editing
const selectedId = ref<string | null>(null);
const draft = ref<MockRule | null>(null);
const leftTab = ref<"rules" | "log">("rules");
const ruleSearch = ref("");
const showTemplates = ref(false);
const rulesScrollEl = ref<HTMLElement | null>(null);
const logScrollEl = ref<HTMLElement | null>(null);

const selectedRule = computed(() => store.rules.find((r) => r.id === selectedId.value) ?? null);

const filteredRules = computed(() => {
  const q = ruleSearch.value.trim().toLowerCase();
  if (!q) return store.rules;
  return store.rules.filter(
    (r) => r.name.toLowerCase().includes(q) || r.urlPattern.toLowerCase().includes(q),
  );
});
const logEntries = computed(() => store.log);
const {
  items: virtualRules,
  topSpacerHeight: rulesTopSpacerHeight,
  bottomSpacerHeight: rulesBottomSpacerHeight,
} = useFixedVirtualList(filteredRules, rulesScrollEl, { itemHeight: 48, overscan: 8 });
const {
  items: virtualLogEntries,
  topSpacerHeight: logTopSpacerHeight,
  bottomSpacerHeight: logBottomSpacerHeight,
} = useFixedVirtualList(logEntries, logScrollEl, { itemHeight: 36, overscan: 8 });

// Open draft when rule selected
watch(selectedRule, (rule) => {
  draft.value = rule
    ? { ...rule, responseHeaders: rule.responseHeaders.map((h) => ({ ...h })) }
    : null;
});

// Auto-save draft with debounce
watchDebounced(
  draft,
  (d) => {
    if (d) store.updateRule(d);
  },
  { deep: true, debounce: 300 },
);

// Body validation
const bodyError = computed(() => {
  if (!draft.value) return null;
  const ct = draft.value.contentType.toLowerCase();
  if (!ct.includes("json") || !draft.value.responseBody.trim()) return null;
  try {
    JSON.parse(draft.value.responseBody);
    return null;
  } catch (e) {
    return (e as Error).message;
  }
});

// Header helpers
function addHeader() {
  if (!draft.value) return;
  const newH: MockResponseHeader = { id: crypto.randomUUID(), name: "", value: "" };
  draft.value = { ...draft.value, responseHeaders: [...draft.value.responseHeaders, newH] };
}

function removeHeader(id: string) {
  if (!draft.value) return;
  draft.value = {
    ...draft.value,
    responseHeaders: draft.value.responseHeaders.filter((h) => h.id !== id),
  };
}

function updateHeader(id: string, field: "name" | "value", val: string) {
  if (!draft.value) return;
  draft.value = {
    ...draft.value,
    responseHeaders: draft.value.responseHeaders.map((h) =>
      h.id === id ? { ...h, [field]: val } : h,
    ),
  };
}

// Rule actions
function createRule(template?: Partial<MockRule>) {
  const id = store.addRule(template ?? {});
  selectedId.value = id;
  leftTab.value = "rules";
}

function deleteRule(id: string) {
  store.deleteRule(id);
  if (selectedId.value === id) {
    selectedId.value = null;
    draft.value = null;
  }
}

function duplicateRule(id: string) {
  const newId = store.duplicateRule(id);
  if (newId) selectedId.value = newId;
}

// Mode management
async function setMode(mode: MockInterceptMode) {
  store.interceptMode = mode;
}

// ADB reverse for HTTP mode
async function setupAdbReverse() {
  const device = targetsStore.selectedTarget;
  if (!device?.deviceSerial) return;
  try {
    await invokeCommand("session_reverse", {
      serial: device.deviceSerial,
      remotePort: store.httpPort,
      localPort: store.httpPort,
    });
  } catch (error) {
    console.warn("Failed to clear mock-server reverse port", device.deviceSerial, error);
  }
}

// Status formatting
function statusColor(code: number | null): string {
  if (!code) return "text-muted-foreground/40";
  if (code < 300) return "text-success";
  if (code < 400) return "text-warning";
  if (code < 500) return "text-warning";
  return "text-error";
}

function methodBadge(method: string): string {
  const map: Record<string, string> = {
    GET: "text-success bg-success/[0.09]",
    POST: "text-info bg-info/[0.09]",
    PUT: "text-warning bg-warning/[0.09]",
    DELETE: "text-error bg-error/[0.09]",
    PATCH: "text-violet-400 bg-violet-400/[0.09]",
    ANY: "text-muted-foreground/70 bg-surface-3",
    HEAD: "text-muted-foreground/70 bg-surface-3",
    OPTIONS: "text-muted-foreground/70 bg-surface-3",
  };
  return map[method] ?? "text-muted-foreground/70 bg-surface-3";
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 5000) return "just now";
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return `${Math.floor(diff / 3600000)}h ago`;
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <!-- Toolbar -->
    <div class="flex h-10 shrink-0 items-center gap-2 border-b border-border/30 bg-surface-2 px-3">
      <!-- Intercept mode toggles -->
      <div class="flex items-center rounded bg-surface-3 p-0.5 gap-0.5">
        <button
          v-for="mode in ['off', 'cdp', 'http'] as MockInterceptMode[]"
          :key="mode"
          class="flex items-center gap-1.5 rounded px-2.5 py-1 text-[11px] font-medium capitalize transition-colors"
          :class="
            store.interceptMode === mode
              ? mode === 'off'
                ? 'bg-background text-foreground/80 shadow-sm'
                : mode === 'cdp'
                  ? 'bg-success/10 text-success shadow-sm'
                  : 'bg-info/10 text-info shadow-sm'
              : 'text-muted-foreground/50 hover:text-foreground/60'
          "
          :title="
            mode === 'off'
              ? 'No interception'
              : mode === 'cdp'
                ? 'Intercept WebView requests via CDP'
                : 'Run local HTTP mock server'
          "
          @click="setMode(mode)"
        >
          <span
            v-if="mode !== 'off' && store.interceptMode === mode"
            class="h-1.5 w-1.5 rounded-full"
            :class="mode === 'cdp' ? 'bg-success animate-pulse' : 'bg-info animate-pulse'"
          />
          <Zap v-if="mode === 'cdp'" class="h-3 w-3" />
          <Server v-else-if="mode === 'http'" class="h-3 w-3" />
          {{ mode.toUpperCase() }}
        </button>
      </div>

      <!-- HTTP port input when HTTP mode -->
      <template v-if="store.interceptMode === 'http'">
        <div class="flex items-center gap-1 rounded border border-border/25 bg-surface-3 px-2">
          <span class="text-[11px] text-muted-foreground/50">Port:</span>
          <input
            v-model.number="store.httpPort"
            type="number"
            class="w-14 bg-transparent text-[11px] font-mono text-foreground/80 outline-none"
            min="1024"
            max="65535"
          />
        </div>
        <button
          class="flex items-center gap-1 rounded border border-border/25 bg-surface-3 px-2 py-1 text-[11px] text-muted-foreground/60 transition-colors hover:text-foreground/70"
          title="Setup ADB reverse port forwarding"
          @click="setupAdbReverse"
        >
          <Radio class="h-3 w-3" />
          ADB Reverse
        </button>
        <span v-if="store.httpServerRunning" class="text-[11px] text-success/80">
          Server running :{{ store.httpPort }}
        </span>
        <span v-else class="text-[11px] text-muted-foreground/40">Server stopped</span>
      </template>

      <!-- CDP mode no-target warning -->
      <template v-if="store.interceptMode === 'cdp' && !hasTarget">
        <div class="flex items-center gap-1.5 text-[11px] text-warning/70">
          <AlertTriangle class="h-3 w-3 shrink-0" />
          No target selected — select a device tab to intercept
        </div>
      </template>

      <div class="flex-1" />

      <!-- Stats -->
      <span class="text-[11px] text-muted-foreground/40">
        {{ store.enabledCount }} active rule{{ store.enabledCount !== 1 ? "s" : "" }}
      </span>

      <!-- New rule button + template dropdown -->
      <div class="relative">
        <div class="flex overflow-hidden rounded border border-border/25">
          <button
            class="flex items-center gap-1 bg-surface-3 px-2.5 py-1 text-[11px] text-muted-foreground/70 transition-colors hover:bg-surface-3/80 hover:text-foreground/80"
            @click="createRule()"
          >
            <Plus class="h-3.5 w-3.5" />
            New Rule
          </button>
          <button
            class="border-l border-border/25 bg-surface-3 px-1.5 text-muted-foreground/50 transition-colors hover:bg-surface-3/80 hover:text-foreground/70"
            title="New from template"
            @click="showTemplates = !showTemplates"
          >
            <ChevronDown class="h-3 w-3" />
          </button>
        </div>

        <!-- Template dropdown -->
        <div
          v-if="showTemplates"
          v-click-outside="() => (showTemplates = false)"
          class="absolute right-0 top-full z-50 mt-1 min-w-[160px] rounded border border-border/30 bg-surface-2 py-1 shadow-lg"
        >
          <button
            v-for="tpl in DEFAULT_RULE_TEMPLATES"
            :key="tpl.label"
            class="flex w-full items-center px-3 py-1.5 text-left text-[11px] text-muted-foreground/70 transition-colors hover:bg-surface-3 hover:text-foreground/80"
            @click="
              createRule(tpl.rule);
              showTemplates = false;
            "
          >
            {{ tpl.label }}
          </button>
        </div>
      </div>
    </div>

    <!-- Main content -->
    <ResizablePanelGroup direction="horizontal" class="min-h-0 flex-1">
      <!-- Left: Rule list + Log -->
      <ResizablePanel :default-size="36" :min-size="26" :max-size="52">
        <div class="flex h-full flex-col overflow-hidden">
          <!-- Left tabs -->
          <div
            class="flex h-8 shrink-0 items-center border-b border-border/25 bg-surface-1 px-2 gap-1"
          >
            <button
              v-for="tab in ['rules', 'log'] as const"
              :key="tab"
              class="h-6 rounded px-2.5 text-[11px] capitalize transition-colors"
              :class="
                leftTab === tab
                  ? 'bg-surface-3 font-medium text-foreground'
                  : 'text-muted-foreground/55 hover:bg-surface-3/60 hover:text-foreground/70'
              "
              @click="leftTab = tab"
            >
              {{ tab === "rules" ? `Rules (${store.rules.length})` : `Log (${store.log.length})` }}
            </button>
            <div class="flex-1" />
            <button
              v-if="leftTab === 'log' && store.log.length"
              class="h-5 rounded px-1.5 text-[10px] text-muted-foreground/40 transition-colors hover:bg-surface-3 hover:text-foreground/60"
              @click="store.clearLog()"
            >
              Clear
            </button>
            <button
              v-if="leftTab === 'rules' && store.rules.length"
              class="h-5 rounded px-1.5 text-[10px] text-muted-foreground/40 transition-colors hover:bg-surface-3 hover:text-foreground/60"
              title="Reset all hit counts"
              @click="store.clearHitCounts()"
            >
              Reset hits
            </button>
          </div>

          <!-- Rules tab -->
          <template v-if="leftTab === 'rules'">
            <!-- Search -->
            <div
              class="flex h-8 shrink-0 items-center gap-1.5 border-b border-border/20 px-2 bg-surface-1/50"
            >
              <input
                v-model="ruleSearch"
                class="min-w-0 flex-1 bg-transparent text-[11px] font-mono outline-none placeholder:text-muted-foreground/30"
                placeholder="Search rules…"
              />
              <button
                v-if="ruleSearch"
                class="text-muted-foreground/40 hover:text-foreground/60"
                @click="ruleSearch = ''"
              >
                <X class="h-3 w-3" />
              </button>
            </div>

            <!-- Empty state -->
            <div
              v-if="!store.rules.length"
              class="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground/35"
            >
              <FilePlus class="h-7 w-7 opacity-30" />
              <span class="text-xs">No rules yet</span>
              <button
                class="mt-1 rounded border border-border/25 px-3 py-1 text-[11px] text-muted-foreground/55 transition-colors hover:border-border/50 hover:text-foreground/70"
                @click="createRule()"
              >
                Create first rule
              </button>
            </div>

            <!-- Rule list -->
            <div v-else ref="rulesScrollEl" class="min-h-0 flex-1 overflow-auto">
              <div class="py-1">
                <div
                  v-if="rulesTopSpacerHeight > 0"
                  :style="{ height: `${rulesTopSpacerHeight}px` }"
                />
                <div
                  v-for="{ data: rule } in virtualRules"
                  :key="rule.id"
                  class="group flex cursor-pointer items-center gap-2 px-2 py-1.5 transition-colors"
                  :class="selectedId === rule.id ? 'bg-surface-3' : 'hover:bg-surface-2/60'"
                  @click="selectedId = rule.id"
                >
                  <!-- Enable switch -->
                  <Switch
                    :checked="rule.enabled"
                    class="scale-75 shrink-0"
                    @update:checked="store.toggleRule(rule.id)"
                    @click.stop
                  />

                  <!-- Method badge -->
                  <span
                    class="shrink-0 rounded px-1.5 py-[1px] font-mono text-[9px] font-semibold leading-none"
                    :class="methodBadge(rule.method)"
                  >
                    {{ rule.method }}
                  </span>

                  <!-- Name + URL pattern -->
                  <div class="min-w-0 flex-1 overflow-hidden">
                    <div
                      class="truncate text-[11px] font-medium text-foreground/80"
                      :class="!rule.enabled ? 'opacity-40' : ''"
                    >
                      {{ rule.name }}
                    </div>
                    <div class="truncate font-mono text-[10px] text-muted-foreground/45">
                      {{ rule.urlPattern || "(no pattern)" }}
                    </div>
                  </div>

                  <!-- Status + hits -->
                  <div class="flex shrink-0 flex-col items-end gap-0.5">
                    <span class="font-mono text-[10px]" :class="statusColor(rule.statusCode)">
                      {{ rule.statusCode }}
                    </span>
                    <span
                      v-if="rule.hitCount > 0"
                      class="rounded bg-surface-3 px-1 font-mono text-[9px] text-muted-foreground/50"
                    >
                      {{ rule.hitCount }}×
                    </span>
                  </div>

                  <!-- Delete (shown on hover) -->
                  <button
                    class="ml-0.5 shrink-0 rounded p-0.5 text-muted-foreground/30 opacity-0 transition-all hover:bg-error/10 hover:text-error/70 group-hover:opacity-100"
                    @click.stop="deleteRule(rule.id)"
                  >
                    <Trash2 class="h-3 w-3" />
                  </button>
                </div>
                <div
                  v-if="rulesBottomSpacerHeight > 0"
                  :style="{ height: `${rulesBottomSpacerHeight}px` }"
                />
              </div>
            </div>
          </template>

          <!-- Log tab -->
          <template v-else>
            <div
              v-if="!store.log.length"
              class="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground/35"
            >
              <Clock class="h-7 w-7 opacity-30" />
              <span class="text-xs">No intercepted requests yet</span>
            </div>
            <div v-else ref="logScrollEl" class="min-h-0 flex-1 overflow-auto">
              <div class="py-1 font-mono text-[10px]">
                <div v-if="logTopSpacerHeight > 0" :style="{ height: `${logTopSpacerHeight}px` }" />
                <div
                  v-for="{ data: entry } in virtualLogEntries"
                  :key="entry.id"
                  class="flex items-center gap-1.5 px-2 py-1.5 hover:bg-surface-2/50"
                >
                  <!-- Status dot -->
                  <span
                    class="h-1.5 w-1.5 shrink-0 rounded-full"
                    :class="
                      entry.noMatch
                        ? 'bg-muted-foreground/30'
                        : entry.passedThrough
                          ? 'bg-warning/60'
                          : 'bg-success/60'
                    "
                  />
                  <!-- Status code -->
                  <span
                    class="w-[26px] shrink-0 text-right"
                    :class="statusColor(entry.responseStatus)"
                  >
                    {{ entry.responseStatus ?? "—" }}
                  </span>
                  <!-- Method -->
                  <span class="w-[36px] shrink-0 text-muted-foreground/55">
                    {{ entry.method }}
                  </span>
                  <!-- URL -->
                  <span class="min-w-0 flex-1 truncate text-foreground/70">
                    {{ entry.url }}
                  </span>
                  <!-- Rule name -->
                  <span class="shrink-0 max-w-[80px] truncate text-muted-foreground/40 italic">
                    {{
                      entry.passedThrough
                        ? "pass"
                        : entry.noMatch
                          ? "no match"
                          : entry.matchedRuleName
                    }}
                  </span>
                  <!-- Time -->
                  <span class="shrink-0 text-muted-foreground/30">
                    {{ timeAgo(entry.timestamp) }}
                  </span>
                </div>
                <div
                  v-if="logBottomSpacerHeight > 0"
                  :style="{ height: `${logBottomSpacerHeight}px` }"
                />
              </div>
            </div>
          </template>
        </div>
      </ResizablePanel>

      <ResizableHandle with-handle />

      <!-- Right: Rule editor -->
      <ResizablePanel :default-size="64" :min-size="40">
        <!-- Empty state -->
        <div
          v-if="!draft"
          class="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground/30"
        >
          <Globe class="h-10 w-10 opacity-20" />
          <p class="text-xs">Select a rule to edit</p>
          <button
            class="mt-1 rounded border border-border/25 px-3 py-1.5 text-[11px] text-muted-foreground/55 transition-colors hover:border-border/50 hover:text-foreground/70"
            @click="createRule()"
          >
            + New rule
          </button>
        </div>

        <!-- Editor -->
        <ScrollArea v-else class="h-full">
          <div class="p-4 space-y-5">
            <!-- Rule name -->
            <div class="flex items-center gap-3">
              <Input
                v-model="draft.name"
                class="flex-1 h-8 border-border/25 bg-surface-2 text-sm font-medium"
                placeholder="Rule name…"
              />
              <button
                class="rounded p-1.5 text-muted-foreground/40 transition-colors hover:bg-surface-3 hover:text-foreground/60"
                title="Duplicate rule"
                @click="duplicateRule(draft.id)"
              >
                <Copy class="h-3.5 w-3.5" />
              </button>
              <button
                class="rounded p-1.5 text-muted-foreground/40 transition-colors hover:bg-error/10 hover:text-error/70"
                title="Delete rule"
                @click="deleteRule(draft.id)"
              >
                <Trash2 class="h-3.5 w-3.5" />
              </button>
            </div>

            <!-- Section: Match -->
            <section>
              <h3
                class="mb-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50"
              >
                Match
              </h3>
              <div class="space-y-2">
                <!-- Method + URL -->
                <div class="flex gap-2">
                  <Select v-model="draft.method">
                    <SelectTrigger
                      class="h-8 w-[100px] shrink-0 border-border/25 bg-surface-2 text-xs"
                      size="sm"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem
                        v-for="m in [
                          'ANY',
                          'GET',
                          'POST',
                          'PUT',
                          'DELETE',
                          'PATCH',
                          'HEAD',
                          'OPTIONS',
                        ]"
                        :key="m"
                        :value="m"
                        class="font-mono text-xs"
                      >
                        {{ m }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    v-model="draft.urlPattern"
                    class="h-8 flex-1 border-border/25 bg-surface-2 font-mono text-xs"
                    :placeholder="
                      draft.urlMatchType === 'contains'
                        ? '/api/users'
                        : draft.urlMatchType === 'glob'
                          ? '/api/users/*'
                          : draft.urlMatchType === 'regex'
                            ? '/api/users/\\d+'
                            : 'https://api.example.com/users'
                    "
                  />
                </div>
                <!-- Match type -->
                <div class="flex items-center gap-2">
                  <span class="text-[11px] text-muted-foreground/50">URL match:</span>
                  <div class="flex gap-0.5">
                    <button
                      v-for="t in ['contains', 'glob', 'regex', 'exact'] as const"
                      :key="t"
                      class="rounded px-2 py-0.5 text-[11px] capitalize transition-colors"
                      :class="
                        draft.urlMatchType === t
                          ? 'bg-surface-3 font-medium text-foreground'
                          : 'text-muted-foreground/50 hover:bg-surface-3/60 hover:text-foreground/70'
                      "
                      @click="draft.urlMatchType = t"
                    >
                      {{ t }}
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <!-- Section: Response -->
            <section>
              <h3
                class="mb-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50"
              >
                Response
              </h3>
              <div class="space-y-2.5">
                <!-- Status + Content-Type + Delay row -->
                <div class="flex flex-wrap gap-2">
                  <div class="flex items-center gap-1.5">
                    <span class="text-[11px] text-muted-foreground/50">Status</span>
                    <input
                      v-model.number="draft.statusCode"
                      type="number"
                      class="h-8 w-16 rounded border border-border/25 bg-surface-2 px-2 text-center font-mono text-xs text-foreground/80 outline-none focus:border-border/60"
                      min="100"
                      max="599"
                    />
                  </div>
                  <div class="flex min-w-0 flex-1 items-center gap-1.5">
                    <span class="shrink-0 text-[11px] text-muted-foreground/50">Type</span>
                    <Select v-model="draft.contentType">
                      <SelectTrigger
                        class="h-8 flex-1 border-border/25 bg-surface-2 text-xs font-mono"
                        size="sm"
                      >
                        <SelectValue placeholder="Content-Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem
                          v-for="ct in [
                            'application/json',
                            'text/plain',
                            'text/html',
                            'application/xml',
                            'application/octet-stream',
                          ]"
                          :key="ct"
                          :value="ct"
                          class="font-mono text-xs"
                        >
                          {{ ct }}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div class="flex items-center gap-1.5">
                    <span class="text-[11px] text-muted-foreground/50">Delay</span>
                    <input
                      v-model.number="draft.delayMs"
                      type="number"
                      class="h-8 w-16 rounded border border-border/25 bg-surface-2 px-2 text-right font-mono text-xs text-foreground/80 outline-none focus:border-border/60"
                      min="0"
                      max="60000"
                    />
                    <span class="text-[11px] text-muted-foreground/40">ms</span>
                  </div>
                </div>

                <!-- Body -->
                <div>
                  <div class="mb-1.5 flex items-center justify-between">
                    <span class="text-[11px] text-muted-foreground/50">Body</span>
                    <span
                      v-if="bodyError"
                      class="flex items-center gap-1 text-[10px] text-error/70"
                    >
                      <AlertTriangle class="h-2.5 w-2.5" />
                      Invalid JSON
                    </span>
                    <span
                      v-else-if="draft.responseBody && draft.contentType.includes('json')"
                      class="flex items-center gap-1 text-[10px] text-success/60"
                    >
                      <Check class="h-2.5 w-2.5" />
                      Valid JSON
                    </span>
                  </div>
                  <Textarea
                    v-model="draft.responseBody"
                    class="min-h-[140px] resize-none border-border/25 bg-surface-2 font-mono text-xs leading-relaxed text-foreground/80"
                    placeholder='{"data": []}'
                    spellcheck="false"
                  />
                </div>
              </div>
            </section>

            <!-- Section: Headers -->
            <section>
              <div class="mb-2.5 flex items-center justify-between">
                <h3
                  class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50"
                >
                  Response Headers
                </h3>
                <button
                  class="flex items-center gap-1 text-[11px] text-muted-foreground/50 transition-colors hover:text-foreground/70"
                  @click="addHeader"
                >
                  <Plus class="h-3 w-3" />
                  Add
                </button>
              </div>
              <div
                v-if="!draft.responseHeaders.length"
                class="text-[11px] italic text-muted-foreground/30"
              >
                No custom headers
              </div>
              <div v-else class="space-y-1.5">
                <div
                  v-for="header in draft.responseHeaders"
                  :key="header.id"
                  class="flex items-center gap-1.5"
                >
                  <input
                    :value="header.name"
                    class="h-7 flex-1 rounded border border-border/20 bg-surface-2 px-2 font-mono text-[11px] text-foreground/80 outline-none focus:border-border/50"
                    placeholder="header-name"
                    @input="
                      updateHeader(header.id, 'name', ($event.target as HTMLInputElement).value)
                    "
                  />
                  <input
                    :value="header.value"
                    class="h-7 flex-1 rounded border border-border/20 bg-surface-2 px-2 font-mono text-[11px] text-foreground/80 outline-none focus:border-border/50"
                    placeholder="value"
                    @input="
                      updateHeader(header.id, 'value', ($event.target as HTMLInputElement).value)
                    "
                  />
                  <button
                    class="shrink-0 rounded p-0.5 text-muted-foreground/35 transition-colors hover:bg-error/10 hover:text-error/70"
                    @click="removeHeader(header.id)"
                  >
                    <X class="h-3 w-3" />
                  </button>
                </div>
              </div>
            </section>

            <!-- Section: Behavior -->
            <section class="border-t border-border/20 pt-4">
              <h3
                class="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50"
              >
                Behavior
              </h3>
              <div class="flex items-center justify-between">
                <div>
                  <div class="text-xs font-medium text-foreground/75">Pass through</div>
                  <div class="mt-0.5 text-[11px] text-muted-foreground/45">
                    Match URL but let request continue to real API
                  </div>
                </div>
                <Switch v-model:checked="draft.passThrough" />
              </div>
            </section>

            <!-- HTTP server info when HTTP mode -->
            <template v-if="store.interceptMode === 'http'">
              <section class="rounded border border-info/20 bg-info/5 p-3">
                <p class="text-[11px] leading-relaxed text-info/70">
                  HTTP server is running on
                  <code class="font-mono">http://127.0.0.1:{{ store.httpPort }}</code
                  >. Configure your Android app to point to this URL, then use
                  <code class="font-mono">ADB Reverse</code> to forward the port.
                </p>
              </section>
            </template>
          </div>
        </ScrollArea>
      </ResizablePanel>
    </ResizablePanelGroup>
  </div>
</template>
