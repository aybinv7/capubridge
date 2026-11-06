import { ref } from "vue";
import { toast } from "@/lib/toast";
import type { MockRule } from "@/types/mock.types";
import { exportMockRule, importMockRule } from "../mockRuleTransfer";
import { useMockStore } from "../stores/useMockStore";

/** Rule import and export through the system file dialogs, one at a time, with toasts. */
export function useMockTransfer(onImported: (id: string) => void) {
  const store = useMockStore();
  const pending = ref(false);

  async function importRule() {
    if (pending.value) return;
    pending.value = true;
    try {
      const rule = await importMockRule();
      if (!rule) return;
      onImported(store.addRule(rule));
      toast("Rule imported", { description: "It was added to the rules of this app." });
    } catch (error) {
      toast.error("Could not import the rule", {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      pending.value = false;
    }
  }

  async function exportRule(rule: MockRule) {
    if (pending.value) return;
    pending.value = true;
    try {
      const path = await exportMockRule(rule);
      if (path) toast("Rule exported", { description: path });
    } catch (error) {
      toast.error("Could not export the rule", {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      pending.value = false;
    }
  }

  return { pending, importRule, exportRule };
}
