import { computed, ref, shallowRef, watch, type Ref } from "vue";
import { useJeepSqlite } from "@/composables/useStorage";
import { invokeCommand } from "@/runtime/ipc/client";
import { useSqlSessionStore } from "@/stores/sqlSession.store";
import { useTargetsStore } from "@/stores/targets.store";
import type { SqliteDbFile } from "@/types/sqlite.types";
import { carryOverUnreachable, mergeSessionIntoList } from "./sqliteDatabaseList";
import { useOpfsSqliteDiscovery } from "./useOpfsSqliteDiscovery";
import { useSqliteRediscovery } from "./useSqliteRediscovery";

export interface SqliteDevice {
  serial: string;
  package: string;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Every SQLite database the selected app has: its own files on the phone (read over ADB), the
 * page's OPFS and jeep databases (read through DevTools), and the pulled copy that is open.
 * A WebView that cannot answer keeps its databases listed as unreachable instead of dropping
 * them; a newer scan always wins over an older one that answers late.
 */
export function useSqliteSources(device: Ref<SqliteDevice | null>) {
  const targets = useTargetsStore();
  const sessions = useSqlSessionStore();
  const { getDomain: jeepDomain } = useJeepSqlite();
  const { discoverOpfsDatabases } = useOpfsSqliteDiscovery();

  const discovered = shallowRef<SqliteDbFile[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const phoneError = ref<string | null>(null);
  const phoneListed = ref(false);
  const complete = ref(false);
  let generation = 0;

  const databases = computed(() => mergeSessionIntoList(sessions.localSession, discovered.value));
  const rediscovery = useSqliteRediscovery(databases, () => refetch());

  async function listJeep(): Promise<SqliteDbFile[]> {
    const targetId = targets.cdpTargetId;
    if (!targetId) return [];
    const found = await jeepDomain().listDatabases();
    return found.map((db) => ({
      name: db.name,
      path: `jeep-sqlite:${db.idbName}/${db.storeName}/${db.key}`,
      size: db.size,
      packageName: device.value?.package || "jeep-sqlite",
      sourceKind: "jeep-sqlite" as const,
      sourceLabel: "jeep-sqlite",
      sourceTargetId: targetId,
      sourceIdbName: db.idbName,
      sourceStoreName: db.storeName,
      sourceKey: db.key,
    }));
  }

  async function listPhone(): Promise<SqliteDbFile[]> {
    const current = device.value;
    if (!current) return [];
    const found = await invokeCommand("sqlite_list_databases", {
      serial: current.serial,
      package: current.package,
    });
    return found.map((db) => ({
      ...db,
      packageName: db.packageName ?? current.package,
      sourceKind: db.sourceKind ?? "native-android",
      sourceLabel: db.sourceLabel ?? "native",
    }));
  }

  async function refetch(): Promise<void> {
    const mine = ++generation;
    loading.value = true;
    try {
      const [phone, jeep, page] = await Promise.allSettled([
        listPhone(),
        listJeep(),
        discoverOpfsDatabases(),
      ]);
      if (mine !== generation) return;
      const away = rediscovery.webviewAway();
      phoneListed.value = phone.status === "fulfilled" && device.value !== null;
      phoneError.value = phone.status === "rejected" ? message(phone.reason) : null;
      const found = [
        ...(phone.status === "fulfilled" ? phone.value : []),
        ...(jeep.status === "fulfilled" ? jeep.value : []),
        ...(page.status === "fulfilled" ? page.value : []),
      ];
      const jeepFound = jeep.status === "fulfilled" ? jeep.value : [];
      const pageFound = page.status === "fulfilled" ? page.value : [];
      discovered.value = carryOverUnreachable(discovered.value, found, {
        opfs: page.status === "fulfilled" && !(away && pageFound.length === 0),
        jeep: jeep.status === "fulfilled" && !(away && jeepFound.length === 0),
      });
      complete.value = page.status === "fulfilled" && jeep.status === "fulfilled" && !away;
      const nothing = found.length === 0 && discovered.value.length === 0;
      error.value =
        nothing && phone.status === "rejected" && jeep.status === "rejected"
          ? message(phone.reason)
          : null;
    } finally {
      if (mine === generation) loading.value = false;
    }
  }

  function forget(path: string) {
    discovered.value = discovered.value.filter((db) => db.path !== path);
  }

  watch(
    () => [device.value?.serial ?? "", device.value?.package ?? "", targets.cdpTargetId] as const,
    (next, previous) => {
      const sameApp = previous && next[0] === previous[0] && next[1] === previous[1];
      if (!sameApp) {
        discovered.value = [];
        complete.value = false;
      }
      void refetch();
    },
    { immediate: true },
  );

  return { databases, loading, error, phoneError, phoneListed, complete, refetch, forget };
}
