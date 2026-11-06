import { formatBytes } from "@/shared/format/numbers";
import type { SqliteDatabaseFacts } from "@/types/sqlite.types";

export type HealthCheckId = "no-key" | "unindexed-links" | "empty" | "no-links" | "free-pages";

/** One finding about the schema or the file, with the tables it is about. */
export interface HealthCheck {
  id: HealthCheckId;
  /** `warn` deserves a look; `info` is a fact worth knowing. */
  level: "warn" | "info";
  text: string;
  detail?: string;
  tables: readonly string[];
}

export const FREE_PAGES_WARN = 0.2;

function plural(count: number, one: string, many: string): string {
  return `${count.toLocaleString("en-US")} ${count === 1 ? one : many}`;
}

/** Share of the file that is free pages, 0–1. */
export function freeShare(facts: Pick<SqliteDatabaseFacts, "freelistCount" | "pageCount">): number {
  return facts.pageCount > 0 ? facts.freelistCount / facts.pageCount : 0;
}

/**
 * The cheap checks, from the facts alone: tables without a primary key, foreign keys without an
 * index, empty tables, a schema that declares no foreign key at all (common for offline-sync
 * apps: links can only be inferred), and a file more than 20 % free pages.
 */
export function healthChecks(
  facts: SqliteDatabaseFacts,
  rowCounts: ReadonlyMap<string, number>,
): HealthCheck[] {
  const tables = facts.tables.filter((table) => table.kind === "table");
  const checks: HealthCheck[] = [];
  const keyless = tables.filter((table) => !table.hasPrimaryKey).map((table) => table.name);
  if (keyless.length) {
    checks.push({
      id: "no-key",
      level: "warn",
      text: `${plural(keyless.length, "table has", "tables have")} no primary key`,
      detail: "Their rows cannot be told apart, so they cannot be edited or followed.",
      tables: keyless,
    });
  }
  const unindexed = tables.flatMap((table) =>
    table.foreignKeys.filter((link) => !link.indexed).map(() => table.name),
  );
  if (unindexed.length) {
    checks.push({
      id: "unindexed-links",
      level: "warn",
      text: `${plural(unindexed.length, "link has", "links have")} no index`,
      detail: "Looking up the rows that point at a row reads the whole table.",
      tables: [...new Set(unindexed)],
    });
  }
  const linked = tables.some((table) => table.foreignKeys.length > 0);
  if (!linked && tables.length > 1) {
    checks.push({
      id: "no-links",
      level: "info",
      text: "No foreign keys are declared",
      detail: "Links between tables can only be inferred from column names (see the Diagram).",
      tables: [],
    });
  }
  const empty = tables
    .filter((table) => rowCounts.get(table.name) === 0)
    .map((table) => table.name);
  if (empty.length) {
    checks.push({
      id: "empty",
      level: "info",
      text: `${plural(empty.length, "table is", "tables are")} empty`,
      tables: empty,
    });
  }
  const share = freeShare(facts);
  if (share > FREE_PAGES_WARN) {
    checks.push({
      id: "free-pages",
      level: "warn",
      text: `${Math.round(share * 100)} % of the file is free pages`,
      detail: `VACUUM would give back ${formatBytes(facts.freelistCount * facts.pageSize)}.`,
      tables: [],
    });
  }
  return checks;
}
