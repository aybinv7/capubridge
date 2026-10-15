import type { Flow } from "@/types/automation.types";
import { parseFlow, serializeFlow } from "./flowSchema";

/** Persistence behind one seam so the backing store can move without touching callers. */
export interface FlowStorage {
  list(): Flow[];
  saveAll(flows: Flow[]): void;
}

/** Storage key for the flow library. Versioned so a future schema can migrate. */
const FLOW_LIBRARY_KEY = "capubridge.automation.flows.v1";

/**
 * LocalStorage-backed flow library. Flows are small JSON documents, so the
 * browser store persists them across restarts with no backend surface.
 * Swap the factory for an app-data file backend later without changing callers.
 */
export function createLocalStorageFlowStorage(storage?: Storage): FlowStorage {
  const backing =
    storage ?? (typeof globalThis.localStorage === "undefined" ? null : globalThis.localStorage);
  if (backing === null) {
    throw new Error("flow storage needs a Web Storage backend");
  }
  return {
    list(): Flow[] {
      const raw = backing.getItem(FLOW_LIBRARY_KEY);
      if (raw === null || raw === "") {
        return [];
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw) as unknown;
      } catch {
        return [];
      }
      if (!Array.isArray(parsed)) {
        return [];
      }
      const flows: Flow[] = [];
      for (const entry of parsed) {
        const result = parseFlow(entry);
        if (result.ok) {
          flows.push(result.flow);
        }
      }
      return flows;
    },
    saveAll(flows: Flow[]): void {
      backing.setItem(
        FLOW_LIBRARY_KEY,
        JSON.stringify(flows.map((flow) => JSON.parse(serializeFlow(flow)) as unknown)),
      );
    },
  };
}
