import { makeGraphId } from "@/modules/storage/graph/storageGraphEntityBuilders";
import type { StorageGraphEntityDescriptor } from "@/types/storageGraph.types";

export interface SqliteSchemaDiagnostic {
  database: string;
  databasePath: string;
  table: string;
  columns: Array<{ name: string; type: string; primaryKey: boolean }>;
  indexes: Array<{ name?: string; columns: string[]; unique?: boolean }>;
  foreignKeys: Array<{
    fromColumn: string;
    toTable: string;
    toColumn: string | null;
    onUpdate?: string | null;
    onDelete?: string | null;
  }>;
}

export function logSqliteSchemaDiagnostics(
  packageName: string,
  descriptors: StorageGraphEntityDescriptor[],
  diagnostics: SqliteSchemaDiagnostic[],
) {
  if (!import.meta.env.DEV) {
    return;
  }

  const knownNodeIds = new Set(descriptors.map((descriptor) => descriptor.id));
  const rows = diagnostics
    .map((diagnostic) => {
      const foreignKeyTargets = diagnostic.foreignKeys.map((foreignKey) => ({
        ...foreignKey,
        targetNodeId: makeGraphId("sqlite", packageName, diagnostic.database, foreignKey.toTable),
      }));
      const unresolvedTargets = foreignKeyTargets.filter(
        (foreignKey) => !knownNodeIds.has(foreignKey.targetNodeId),
      );

      return {
        database: diagnostic.database,
        path: diagnostic.databasePath,
        table: diagnostic.table,
        columns: diagnostic.columns.length,
        primaryKeys: diagnostic.columns
          .filter((column) => column.primaryKey)
          .map((column) => column.name)
          .join(", "),
        indexes: diagnostic.indexes.map((index) => index.columns.join(" + ")).join(", "),
        foreignKeys: foreignKeyTargets
          .map(
            (foreignKey) =>
              `${foreignKey.fromColumn} -> ${foreignKey.toTable}.${foreignKey.toColumn ?? "?"}`,
          )
          .join(", "),
        resolved: `${foreignKeyTargets.length - unresolvedTargets.length}/${foreignKeyTargets.length}`,
        unresolvedTargets: unresolvedTargets
          .map((foreignKey) => `${foreignKey.toTable}.${foreignKey.toColumn ?? "?"}`)
          .join(", "),
      };
    })
    .sort(
      (left, right) =>
        left.database.localeCompare(right.database) || left.table.localeCompare(right.table),
    );
  const foreignKeyCount = diagnostics.reduce(
    (total, diagnostic) => total + diagnostic.foreignKeys.length,
    0,
  );
  const unresolvedCount = rows.reduce(
    (total, row) => total + (row.unresolvedTargets ? row.unresolvedTargets.split(", ").length : 0),
    0,
  );

  console.groupCollapsed(
    `[storage-graph][sqlite] ${packageName}: ${diagnostics.length} tables, ${foreignKeyCount} foreign keys, ${unresolvedCount} unresolved`,
  );
  console.table(rows);
  if (foreignKeyCount === 0) {
    console.warn(
      "[storage-graph][sqlite] PRAGMA foreign_key_list returned no foreign keys for every table",
    );
  }
  if (unresolvedCount > 0) {
    console.warn(
      "[storage-graph][sqlite] some foreign keys reference table nodes that were not generated",
      rows.filter((row) => row.unresolvedTargets),
    );
  }
  console.log("[storage-graph][sqlite] raw schema", diagnostics);
  console.log(
    "[storage-graph][sqlite] generated relationships",
    descriptors.flatMap((descriptor) =>
      descriptor.fields
        .filter((field) => field.references)
        .map((field) => ({
          sourceTable: descriptor.title,
          sourceColumn: field.name,
          targetNodeId: field.references?.targetNodeId,
          targetColumn: field.references?.targetFieldName,
          targetResolved: knownNodeIds.has(field.references?.targetNodeId ?? ""),
        })),
    ),
  );
  console.groupEnd();
}

function quoteSqlIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function relationNameVariants(columnName: string): string[] {
  const stem = columnName.toLowerCase().replace(/_id$/, "");
  const variants = new Set([stem, `${stem}s`]);
  if (stem.endsWith("y")) {
    variants.add(`${stem.slice(0, -1)}ies`);
  }
  return Array.from(variants);
}

function findLogicalTarget(
  source: SqliteSchemaDiagnostic,
  columnName: string,
  diagnostics: SqliteSchemaDiagnostic[],
): { table: string; primaryKey: string } | null {
  const variants = relationNameVariants(columnName);
  const candidates = diagnostics
    .filter(
      (candidate) =>
        candidate.databasePath === source.databasePath && candidate.table !== source.table,
    )
    .flatMap((candidate) => {
      const primaryKey = candidate.columns.find((column) => column.primaryKey);
      if (!primaryKey) {
        return [];
      }
      const tableName = candidate.table.toLowerCase();
      const exact = variants.includes(tableName);
      const suffix = variants.some((variant) => tableName.endsWith(`_${variant}`));
      if (!exact && !suffix) {
        return [];
      }
      return [
        {
          table: candidate.table,
          primaryKey: primaryKey.name,
          score: exact ? 100 : 80 - candidate.table.split("_").length,
        },
      ];
    })
    .sort(
      (left, right) =>
        right.score - left.score || left.table.split("_").length - right.table.split("_").length,
    );
  const best = candidates[0];
  const second = candidates[1];
  if (!best || (second && best.score === second.score)) {
    return null;
  }
  return { table: best.table, primaryKey: best.primaryKey };
}

export async function discoverLogicalSqliteReferences(
  diagnostics: SqliteSchemaDiagnostic[],
  validate: (databasePath: string, sql: string) => Promise<{ rows: unknown[][] }>,
) {
  const candidates = diagnostics.flatMap((source) =>
    source.columns.flatMap((column) => {
      if (column.primaryKey || !column.name.toLowerCase().endsWith("_id")) {
        return [];
      }
      const indexed = source.indexes.some((index) => index.columns.includes(column.name));
      if (!indexed) {
        return [];
      }
      const target = findLogicalTarget(source, column.name, diagnostics);
      return target ? [{ source, sourceColumn: column.name, ...target }] : [];
    }),
  );
  const validated = [];

  for (let offset = 0; offset < candidates.length; offset += 6) {
    const batch = candidates.slice(offset, offset + 6);
    const results = await Promise.all(
      batch.map(async (candidate) => {
        const sourceTable = quoteSqlIdentifier(candidate.source.table);
        const sourceColumn = quoteSqlIdentifier(candidate.sourceColumn);
        const targetTable = quoteSqlIdentifier(candidate.table);
        const targetColumn = quoteSqlIdentifier(candidate.primaryKey);
        const sql = `SELECT COUNT(*) AS sampled, SUM(CASE WHEN EXISTS (SELECT 1 FROM ${targetTable} AS target WHERE target.${targetColumn} = sample.value) THEN 1 ELSE 0 END) AS matched FROM (SELECT DISTINCT ${sourceColumn} AS value FROM ${sourceTable} WHERE ${sourceColumn} IS NOT NULL LIMIT 40) AS sample`;
        try {
          const result = await validate(candidate.source.databasePath, sql);
          const sampled = Number(result.rows[0]?.[0] ?? 0);
          const matched = Number(result.rows[0]?.[1] ?? 0);
          return sampled > 0 && matched / sampled >= 0.8
            ? { ...candidate, sampled, matched }
            : null;
        } catch {
          return null;
        }
      }),
    );
    validated.push(...results.filter((result) => result !== null));
  }

  return validated;
}
