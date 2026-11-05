import { computed, onScopeDispose, ref, watch, type Ref } from "vue";
import { watchDebounced } from "@vueuse/core";
import type { MockRule } from "@/types/mock.types";
import { useMockStore } from "../stores/useMockStore";
import { applyDraft, draftFromRule, sameEditorFields, type MockRuleDraft } from "./mockDraft";

export const DRAFT_SAVE_MS = 300;

/**
 * The editable copy of the selected rule. The editor replaces the draft on every edit, so a new
 * draft object is the change marker: nothing is serialised to tell edits from echoes. Edits save
 * shortly after the last one, before the selection or the app changes, and before an export or a
 * duplicate reads the rule. Only the editor's fields are written, so a switch flipped meanwhile is
 * kept; a change made elsewhere (an import, an MCP client) replaces the draft.
 */
export function useMockRuleDraft(selectedId: Ref<string | null>) {
  const store = useMockStore();
  const draft = ref<MockRuleDraft | null>(null);
  let owner: string | null = null;
  let loaded: MockRuleDraft | null = null;
  let stored: MockRule | null = null;

  const rule = computed(
    () => store.rules.find((candidate) => candidate.id === selectedId.value) ?? null,
  );

  function ownerRule(): MockRule | null {
    return owner === null
      ? null
      : (store.rules.find((candidate) => candidate.id === owner) ?? null);
  }

  function load() {
    owner = selectedId.value;
    const current = ownerRule();
    draft.value = current ? draftFromRule(current) : null;
    loaded = draft.value;
    stored = current;
  }

  /** Writes the draft to its rule now, if it changed since it was loaded or last saved. */
  function save() {
    const current = ownerRule();
    const next = draft.value;
    if (!current || !next || next === loaded) return;
    loaded = next;
    const updated = applyDraft(current, next);
    stored = updated;
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

  watch(rule, (current) => {
    if (current === null) {
      draft.value = null;
      loaded = null;
      stored = null;
      owner = null;
      return;
    }
    if (current === stored) return;
    if (stored && current.id === stored.id && sameEditorFields(current, stored)) {
      stored = current;
      return;
    }
    load();
  });

  watchDebounced(draft, save, { debounce: DRAFT_SAVE_MS });
  const stopScopeListener = store.onBeforeScopeChange(save);
  onScopeDispose(() => {
    save();
    stopScopeListener();
  });

  return { draft, rule, save };
}
