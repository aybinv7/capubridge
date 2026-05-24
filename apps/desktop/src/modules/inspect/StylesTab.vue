<script setup lang="ts">
import { ref, computed } from "vue";
import { Search } from "lucide-vue-next";
import { storeToRefs } from "pinia";
import type { MatchedStyles, CSSProperty, CSSRule, SourceRange } from "utils";
import { useInspectStore } from "@/stores/inspect.store";
import StyleRuleBlock from "./StyleRuleBlock.vue";
import { useElementMutations } from "./useElementMutations";
import { serializeProperties, applyPropertyChange, removePropertyAt } from "./styleSerialize";

const props = defineProps<{
  styles: MatchedStyles | null;
  isLoading: boolean;
}>();

const emit = defineEmits<{
  refresh: [];
}>();

const store = useInspectStore();
const { selectedNodeId } = storeToRefs(store);
const mutations = useElementMutations();

const filter = ref("");

interface RuleView {
  key: string;
  selector: string | null;
  origin?: string;
  source?: string | null;
  properties: CSSProperty[];
  editTarget:
    | { kind: "inline"; nodeId: number }
    | { kind: "rule"; styleSheetId: string; range: SourceRange }
    | { kind: "readonly" };
  inheritedFrom?: string | null;
}

const ruleViews = computed<RuleView[]>(() => {
  const out: RuleView[] = [];
  const s = props.styles;
  const nodeId = selectedNodeId.value;
  if (!s || nodeId === null) return out;

  out.push({
    key: "inline",
    selector: null,
    origin: "regular",
    source: null,
    properties: s.inlineStyle?.cssProperties ?? [],
    editTarget: { kind: "inline", nodeId },
  });

  for (let i = 0; i < s.matchedCSSRules.length; i++) {
    const m = s.matchedCSSRules[i];
    out.push(ruleToView(m.rule, `match-${i}`));
  }

  s.inherited?.forEach((group, gi) => {
    group.matchedCSSRules.forEach((m, ri) => {
      out.push({
        ...ruleToView(m.rule, `inh-${gi}-${ri}`),
        inheritedFrom:
          ri === 0 ? `<${m.rule.selectorList.text.split(/[\s>]/)[0] ?? "parent"}>` : null,
      });
    });
  });

  return out;
});

function ruleToView(rule: CSSRule, key: string): RuleView {
  const editable =
    rule.origin === "regular" || rule.origin === "inspector" || rule.origin === "injected";
  return {
    key,
    selector: rule.selectorList.text,
    origin: rule.origin,
    source: rule.styleSheetId ? null : null,
    properties: rule.style.cssProperties,
    editTarget:
      editable && rule.styleSheetId && rule.style.range
        ? { kind: "rule", styleSheetId: rule.styleSheetId, range: rule.style.range }
        : { kind: "readonly" },
  };
}

const filteredViews = computed(() => {
  const q = filter.value.trim().toLowerCase();
  if (!q) return ruleViews.value;
  return ruleViews.value.filter((v) => {
    if (v.selector && v.selector.toLowerCase().includes(q)) return true;
    return v.properties.some(
      (p) => p.name.toLowerCase().includes(q) || p.value.toLowerCase().includes(q),
    );
  });
});

async function commit(view: RuleView, nextProps: CSSProperty[]) {
  const text = serializeProperties(nextProps);
  if (view.editTarget.kind === "rule") {
    await mutations.setStyleText(view.editTarget.styleSheetId, view.editTarget.range, text);
  } else if (view.editTarget.kind === "inline") {
    const live = nextProps
      .filter((p) => !p.disabled && p.name && p.value)
      .map((p) => `${p.name}: ${p.value}${p.important ? " !important" : ""};`)
      .join(" ");
    await mutations.setInlineStyle(view.editTarget.nodeId, live);
  } else {
    return;
  }
  emit("refresh");
}

async function onChange(
  view: RuleView,
  index: number,
  next: { name: string; value: string; disabled: boolean; important: boolean },
) {
  const updated = applyPropertyChange(view.properties, index, next);
  await commit(view, updated);
}

async function onRemove(view: RuleView, index: number) {
  const updated = removePropertyAt(view.properties, index);
  await commit(view, updated);
}

async function onAdd(view: RuleView, next: { name: string; value: string; important?: boolean }) {
  const updated = applyPropertyChange(view.properties, -1, {
    name: next.name,
    value: next.value,
    disabled: false,
    important: next.important,
  });
  await commit(view, updated);
}
</script>

<template>
  <div class="flex flex-col h-full text-xs font-mono">
    <div class="flex items-center gap-1 px-2 py-1 border-b border-border/20 shrink-0">
      <Search class="w-3 h-3 text-muted-foreground/40" />
      <input
        v-model="filter"
        placeholder="Filter styles..."
        class="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/30"
      />
      <span v-if="mutations.isMutating.value" class="text-[10px] text-blue-400/70">saving…</span>
    </div>

    <div
      v-if="mutations.lastError.value"
      class="px-2 py-1 text-[10px] text-red-300 bg-red-500/10 border-b border-red-500/20 shrink-0"
    >
      {{ mutations.lastError.value }}
      <button class="ml-2 underline" @click="mutations.clearLastError()">dismiss</button>
    </div>

    <div class="flex-1 min-h-0 overflow-auto px-1 py-1 space-y-2">
      <div v-if="isLoading" class="text-muted-foreground/40 text-center py-4">Loading styles…</div>

      <template v-else-if="selectedNodeId !== null">
        <StyleRuleBlock
          v-for="view in filteredViews"
          :key="view.key"
          :selector="view.selector"
          :origin="view.origin"
          :source="view.source"
          :properties="view.properties"
          :editable="view.editTarget.kind !== 'readonly'"
          :inherited-from="view.inheritedFrom"
          :show-add-row="view.editTarget.kind === 'inline'"
          @change="(i, next) => onChange(view, i, next)"
          @remove="(i) => onRemove(view, i)"
          @add="(next) => onAdd(view, next)"
        />
      </template>

      <div v-else class="text-muted-foreground/40 text-center py-4">
        Select an element to see styles
      </div>
    </div>
  </div>
</template>
