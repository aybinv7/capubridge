<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useStorage } from "@vueuse/core";
import { Button } from "@capubridge/cladd";
import { toast } from "vue-sonner";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { targetAppName } from "@/lib/target-app-name";
import { useTargetsStore } from "@/stores/targets.store";
import type { MockRule } from "@/types/mock.types";
import { useMockStore } from "../stores/useMockStore";
import MockModeGuide from "./MockModeGuide.vue";
import MockRuleEditor from "./MockRuleEditor.vue";
import MockSidebar from "./MockSidebar.vue";
import MockToolbar from "./MockToolbar.vue";
import { rulesSummary, scopeWords } from "./mockView";
import { useMockCommands } from "./useMockCommands";
import { useMockReverse } from "./useMockReverse";
import { useMockRuleDraft } from "./useMockRuleDraft";
import { useMockTransfer } from "./useMockTransfer";

const store = useMockStore();
const targets = useTargetsStore();
const route = useRoute();
const router = useRouter();

const selectedId = ref<string | null>(null);
const sidebarView = ref<"rules" | "log">("rules");
const guideOpen = useStorage("capubridge:network:mock-guide-open", false);

const { draft } = useMockRuleDraft(selectedId);
const transfer = useMockTransfer(select);
const reverse = useMockReverse();

const scope = computed(() =>
  scopeWords(targets.selectedTarget, targetAppName(targets.selectedTarget, null)),
);
const summary = computed(() => rulesSummary(store.enabledCount, store.rules.length));
const modeModel = computed({
  get: () => store.interceptMode,
  set: (value) => {
    store.interceptMode = value;
  },
});
const portModel = computed({
  get: () => store.httpPort,
  set: (value) => {
    store.httpPort = value;
  },
});

function select(id: string) {
  selectedId.value = id;
  sidebarView.value = "rules";
}

function clearSelection() {
  selectedId.value = null;
}

function create(template?: Partial<MockRule>) {
  select(store.addRule(template ?? {}));
}

function duplicate(id: string) {
  const copy = store.duplicateRule(id);
  if (copy) select(copy);
}

function remove(id: string) {
  const index = store.rules.findIndex((rule) => rule.id === id);
  const rule = store.rules[index];
  if (!rule) return;
  store.deleteRule(id);
  if (selectedId.value === id) selectedId.value = null;
  toast(`Deleted “${rule.name}”`, {
    action: {
      label: "Undo",
      onClick: () => {
        const rules = store.rules;
        store.rules = [...rules.slice(0, index), rule, ...rules.slice(index)];
      },
    },
  });
}

function exportSelected() {
  const rule = store.rules.find((candidate) => candidate.id === selectedId.value);
  if (rule) void transfer.exportRule(rule);
}

watch(
  () => store.currentScope,
  () => clearSelection(),
);

watch(
  () => route.query.rule,
  (rule) => {
    if (typeof rule !== "string") return;
    select(rule);
    void router.replace({ query: { ...route.query, rule: undefined } });
  },
  { immediate: true },
);

useMockCommands({ create, importRule: transfer.importRule });
</script>

<template>
  <div class="@container flex h-full flex-col overflow-hidden">
    <MockToolbar
      v-model:mode="modeModel"
      v-model:port="portModel"
      v-model:guide-open="guideOpen"
      :server-running="store.httpServerRunning"
      :has-target="!!targets.cdpTargetId"
      :can-reverse="!!reverse.serial.value"
      :reversing="reverse.running.value"
      :transfer-pending="transfer.pending.value"
      :scope="scope"
      :summary="summary"
      @reverse="reverse.connect()"
      @import="transfer.importRule()"
      @create="create"
    />
    <MockModeGuide v-if="guideOpen" :port="store.httpPort" />
    <ResizablePanelGroup
      direction="horizontal"
      auto-save-id="capubridge:network-mock"
      class="min-h-0 flex-1"
    >
      <ResizablePanel
        id="network-mock-rules"
        :order="1"
        :default-size="34"
        :min-size="24"
        :max-size="52"
      >
        <MockSidebar
          v-model:view="sidebarView"
          :rules="store.rules"
          :log="store.log"
          :selected-id="selectedId"
          @select="select"
          @open-rule="select"
          @clear="clearSelection"
          @toggle="store.setRuleEnabled"
          @remove="remove"
          @reset-hits="store.clearHitCounts()"
          @clear-log="store.clearLog()"
        />
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel id="network-mock-editor" :order="2" :min-size="40">
        <div class="h-full border-l border-border-subtle">
          <MockRuleEditor
            v-if="draft"
            :key="selectedId ?? ''"
            v-model:draft="draft"
            :mode="store.interceptMode"
            :port="store.httpPort"
            :transfer-pending="transfer.pending.value"
            @duplicate="selectedId && duplicate(selectedId)"
            @export="exportSelected"
            @remove="selectedId && remove(selectedId)"
          />
          <div
            v-else-if="store.rules.length"
            class="flex h-full items-center justify-center p-8 text-xs text-muted-foreground"
          >
            Choose a rule on the left to edit it.
          </div>
          <div
            v-else
            class="flex h-full flex-col items-center justify-center gap-4 p-8 text-center"
          >
            <p class="max-w-sm text-xs text-muted-foreground">
              A rule answers matching requests with a response you write, so you can try errors,
              slow servers and new data without touching the backend. In Requests, “Mock this
              response” turns a real answer into a rule.
            </p>
            <div class="flex gap-2">
              <Button size="sm" variant="solid-fill" @click="create()">New rule</Button>
              <Button
                size="sm"
                variant="transparent"
                @click="router.push({ name: 'network-requests' })"
              >
                Go to requests
              </Button>
            </div>
          </div>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  </div>
</template>
