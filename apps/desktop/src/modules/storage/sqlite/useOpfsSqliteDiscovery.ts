import { OpfsSqliteDiscovery } from "@capubridge/cdp-protocol";
import { useCDP } from "@/composables/useCDP";
import { useTargetsStore } from "@/stores/targets.store";
import type { SqliteDbFile } from "@/types/sqlite.types";

/**
 * Finds every SQLite database reachable through the connected WebView's OPFS,
 * so the SQL Explorer lists them without the user first decoding a SAH-Pool by
 * hand in the OPFS panel.
 */
export function useOpfsSqliteDiscovery() {
  const targetsStore = useTargetsStore();
  const { getClient } = useCDP();

  async function discoverOpfsDatabases(): Promise<SqliteDbFile[]> {
    const targetId = targetsStore.cdpTargetId;
    if (!targetId) return [];
    const client = getClient(targetId);
    if (!client) return [];

    const found = await new OpfsSqliteDiscovery(client).discover();
    return found.map((db) => ({
      name: db.name,
      path: `opfs:${db.path}`,
      size: db.size,
      sourceKind: "opfs" as const,
      sourceLabel: db.stripSahPoolHeader ? "opfs sah-pool" : "opfs",
      sourceTargetId: targetId,
      sourceOpfsPath: db.path,
      sourceOpfsDirectory: db.directory,
      stripSahPoolHeader: db.stripSahPoolHeader,
      sourceTech: db.tech,
    }));
  }

  return { discoverOpfsDatabases };
}
