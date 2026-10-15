import { useNetworkStore } from "@/modules/network/stores/useNetworkStore";
import { useIndexedDBChangesStore } from "@/modules/storage/stores/useIndexedDBChangesStore";
import { useSqliteChangesStore } from "@/modules/storage/stores/useSqliteChangesStore";
import { useConsoleStore } from "@/stores/console.store";
import type { SessionSignalState } from "@/types/automation.types";

export function readAutomationSignals(serial?: string, appPackage?: string): SessionSignalState {
  const networkStore = useNetworkStore();
  const indexedDbStore = useIndexedDBChangesStore();
  const sqliteStore = useSqliteChangesStore();
  const consoleStore = useConsoleStore();
  const sqliteWrite = sqliteStore.changes.find(
    (entry) =>
      (serial === undefined || entry.serial === serial) &&
      (appPackage === undefined || appPackage === "" || entry.packageName === appPackage),
  );
  const sqliteAt = sqliteWrite?.observedAt ?? null;
  const indexedDbAt = indexedDbStore.lastEventAt;
  const latestDbWrite = [
    sqliteAt === null ? null : { source: "sqlite", at: sqliteAt },
    indexedDbAt === null ? null : { source: "indexedDB", at: indexedDbAt },
  ]
    .filter((entry): entry is { source: string; at: string } => entry !== null)
    .sort((left, right) => Date.parse(right.at) - Date.parse(left.at))[0];
  return {
    pendingRequests: networkStore.allEntries.filter((entry) => entry.state === "pending").length,
    recentErrors: consoleStore.entries
      .filter((entry) => entry.level === "error")
      .slice(-20)
      .map((entry) => entry.message),
    lastDbWrite: latestDbWrite === undefined ? null : `${latestDbWrite.source}:${latestDbWrite.at}`,
  };
}

export function readAutomationNetwork(): Array<{
  url: string;
  method: string;
  status: number | null;
}> {
  const networkStore = useNetworkStore();
  return networkStore.allEntries.slice(-100).map((entry) => ({
    url: entry.url,
    method: entry.method,
    status: entry.httpStatus,
  }));
}
