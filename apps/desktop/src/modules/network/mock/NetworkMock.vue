<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useStorage } from "@vueuse/core";
import { toast } from "@/lib/toast";
import { useAppPackages } from "@/composables/useAppPackages";
import { targetAppName } from "@/lib/target-app-name";
import { useTargetsStore } from "@/stores/targets.store";
import type { MockRule } from "@/types/mock.types";
import { useMockStore } from "../stores/useMockStore";
import MockInterceptionNote from "./MockInterceptionNote.vue";
import MockModeGuide from "./MockModeGuide.vue";
import MockOnboarding from "./MockOnboarding.vue";
import MockRuleEditor from "./MockRuleEditor.vue";
import MockToolbar from "./MockToolbar.vue";
import MockWorkspace from "./MockWorkspace.vue";
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

const { draft, save } = useMockRuleDraft(selectedId);
const transfer = useMockTransfer(select);
const reverse = useMockReverse();

const { getCachedPackage } = useAppPackages(
  computed(() => targets.selectedTarget?.deviceSerial ?? ""),
);
const appLabel = computed(() => {
  const name = targets.selectedTarget?.packageName;
  return name ? (getCachedPackage(name)?.label ?? null) : null;
});
const scope = computed(() =>
  scopeWords(targets.selectedTarget, targetAppName(targets.selectedTarget, appLabel.value)),
);
const summary = computed(() =>
  rulesSummary(store.enabledCount, store.rules.length, store.interceptMode),
);
const onboarding = computed(() => store.rules.length === 0 && store.log.length === 0);
const showOffNote = computed(() => store.interceptMode === "off" && store.enabledCount > 0);
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
  save();
  const copy = store.duplicateRule(id);
  if (copy) select(copy);
}

function remove(id: string) {
  if (selectedId.value === id) save();
  const removed = store.deleteRule(id);
  if (!removed) return;
  if (selectedId.value === id) selectedId.value = null;
  toast(`Deleted “${removed.rule.name}”`, {
    action: { label: "Undo", onClick: () => store.restoreRule(removed) },
  });
}

function exportSelected() {
  save();
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
    <MockInterceptionNote
      v-if="showOffNote"
      :rule-count="store.enabledCount"
      :has-target="!!targets.cdpTargetId"
      @turn-on="store.interceptMode = 'cdp'"
    />
    <MockOnboarding
      v-if="onboarding"
      class="min-h-0 flex-1"
      :can-open-requests="router.hasRoute('network-requests')"
      @create="create"
      @open-requests="router.push({ name: 'network-requests' })"
    />
    <MockWorkspace
      v-else
      v-model:view="sidebarView"
      :rules="store.rules"
      :log="store.log"
      :selected-id="selectedId"
      :hits="store.hitCountOf"
      :any-hits="store.anyHits"
      :pane-open="!!draft"
      @select="select"
      @open-rule="select"
      @clear="clearSelection"
      @toggle="store.setRuleEnabled"
      @remove="remove"
      @reset-hits="store.clearHitCounts()"
      @clear-log="store.clearLog()"
    >
      <template #pane>
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
          @close="clearSelection"
        />
      </template>
    </MockWorkspace>
  </div>
</template>
