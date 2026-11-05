import { computed, onScopeDispose, ref, watch, type Ref } from "vue";
import { watchDebounced } from "@vueuse/core";
import type { MockRule } from "@/types/mock.types";
import { useMockStore } from "../stores/useMockStore";
import {
  applyDraft,
  draftFields,
  draftFromRule,
  draftSignature,
  type MockRuleDraft,
} from "./mockDraft";

export const DRAFT_SAVE_MS = 300;

function storedSignature(rule: MockRule): string {
  return draftSignature(draftFields(rule));
}

/**
 * The editable copy of the selected rule. Edits save themselves shortly after the last change and
 * only touch the fields the editor owns, so a hit counted or a switch flipped meanwhile is kept.
 * A change made elsewhere (an import, an MCP client) replaces the draft; the echo of this draft's
 * own save does not, so typing is never interrupted.
 */
export function useMockRuleDraft(selectedId: Ref<string | null>) {
  const store = useMockStore();
  const draft = ref<MockRuleDraft | null>(null);
  let owner: string | null = null;
  let baseline: string | null = null;
  let stored: string | null = null;

  const rule = computed(
    () => store.rules.find((candidate) => candidate.id === selectedId.value) ?? null,
  );
  const ruleSignature = computed(() => (rule.value ? storedSignature(rule.value) : null));

  function ownerRule(): MockRule | null {
    return owner === null
      ? null
      : (store.rules.find((candidate) => candidate.id === owner) ?? null);
  }

  function load() {
    owner = selectedId.value;
    const current = ownerRule();
    draft.value = current ? draftFromRule(current) : null;
    baseline = draft.value ? draftSignature(draft.value) : null;
    stored = current ? storedSignature(current) : null;
  }

  function save() {
    const current = ownerRule();
    const next = draft.value;
    if (!current || !next) return;
    const signature = draftSignature(next);
    if (signature === baseline) return;
    baseline = signature;
    const updated = applyDraft(current, next);
    stored = storedSignature(updated);
    store.updateRule(updated);
  }

  watch(
    selectedId,
    () => {
      save();
      load();
    },
    { immediate: true },
  );

  watch(ruleSignature, (signature) => {
    if (signature === null) {
      draft.value = null;
      baseline = null;
      stored = null;
    } else if (signature !== stored) {
      load();
    }
  });

  watchDebounced(draft, save, { deep: true, debounce: DRAFT_SAVE_MS });
  onScopeDispose(save);

  return { draft, rule, save };
}
