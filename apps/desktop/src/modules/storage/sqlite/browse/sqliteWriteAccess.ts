import { computed, type Ref } from "vue";
import { toast } from "vue-sonner";
import type { Provenance } from "@/lib/provenance";
import type { LocalSqlSession } from "@/stores/sqlSession.store";
import type { SqliteDbFile } from "@/types/sqlite.types";

/**
 * Why a database cannot be written here, or `null` when writes reach its source.
 * Only an imported file is its own source: every device database is read through a
 * pulled copy that the next refresh overwrites, so writing to it would report a
 * change the device never received.
 */
export function sqliteReadOnlyReason(
  session: LocalSqlSession | null,
  db: SqliteDbFile | null,
): string | null {
  if (session?.sourceKind === "imported") return null;
  if (db?.sourceKind === "native-android") {
    return "Native Android databases are read-only: they are pulled to this computer as a copy.";
  }
  return "Read-only for now: this is a copy pulled from the device, and edits are not written back to it yet.";
}

export function useSqliteWriteAccess(
  session: Ref<LocalSqlSession | null>,
  db: Ref<SqliteDbFile | null>,
) {
  const readOnlyReason = computed(() => sqliteReadOnlyReason(session.value, db.value));
  const provenance = computed<Provenance>(() =>
    readOnlyReason.value === null ? "imported" : "local",
  );

  /** `true` when a write may proceed; otherwise explains why not and returns `false`. */
  function guardWrite(): boolean {
    if (readOnlyReason.value === null) return true;
    toast.info("This database is read-only here", { description: readOnlyReason.value });
    return false;
  }

  return { readOnlyReason, provenance, guardWrite };
}
