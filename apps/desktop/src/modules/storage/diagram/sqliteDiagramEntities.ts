import type { SqliteColumnInfo, SqliteForeignKeyInfo, SqliteIndexInfo } from "@/types/sqlite.types";
import type { StorageGraphEntityDescriptor } from "@/types/storageGraph.types";
import { buildSqliteDescriptor, makeGraphId } from "./storageGraphEntityBuilders";
import {
  discoverLogicalSqliteReferences,
  logSqliteSchemaDiagnostics,
  type SqliteSchemaDiagnostic,
} from "./storageGraphSqliteDiagnostics";

/** How one table is built, as the diagram needs it. */
export interface SqliteTableSchema {
  table: { name: string; rowCount: number };
  columns: readonly SqliteColumnInfo[];
  indexes: readonly SqliteIndexInfo[];
  foreignKeys: readonly SqliteForeignKeyInfo[];
}

/** One database's tables, and where "Open data" goes for each. */
export interface SqliteDatabaseSchema {
  name: string;
  path: string;
  tables: readonly SqliteTableSchema[];
  openPath?: (table: string) => string;
}

/** Runs one read-only query on a database, by its path. */
export type SqliteValidate = (databasePath: string, sql: string) => Promise<{ rows: unknown[][] }>;

function diagnosticOf(database: SqliteDatabaseSchema, schema: SqliteTableSchema) {
  return {
    database: database.name,
    databasePath: database.path,
    table: schema.table.name,
    columns: schema.columns.map((column) => ({
      name: column.name,
      type: column.colType,
      primaryKey: column.pk > 0,
    })),
    indexes: schema.indexes.map((index) => ({
      name: index.name,
      columns: index.columns,
      unique: index.unique,
    })),
    foreignKeys: schema.foreignKeys.map((foreignKey) => ({
      fromColumn: foreignKey.fromColumn,
      toTable: foreignKey.toTable,
      toColumn: foreignKey.toColumn,
      onUpdate: foreignKey.onUpdate,
      onDelete: foreignKey.onDelete,
    })),
  } satisfies SqliteSchemaDiagnostic;
}

/**
 * The name each database's node ids are built from: its name, or its path when that name is
 * already taken (`taken`, or an earlier database of the list), so two `app.db` files never
 * share nodes (B5). The first one keeps its name, so saved layouts keep their nodes.
 */
export function sqliteIdNames(
  databases: readonly Pick<SqliteDatabaseSchema, "name" | "path">[],
  taken: ReadonlySet<string> = new Set(),
): Map<string, string> {
  const used = new Set(taken);
  const names = new Map<string, string>();
  for (const database of databases) {
    const name = used.has(database.name) ? database.path : database.name;
    used.add(database.name);
    names.set(database.path, name);
  }
  return names;
}

/**
 * The diagram's tables of one or more databases: columns, indexes and declared foreign keys,
 * plus the `*_id` links the data itself confirms (checked by `validate` on each database).
 * `takenNames` are database names already drawn (the open database).
 */
export async function sqliteDiagramEntities(
  packageName: string,
  databases: readonly SqliteDatabaseSchema[],
  validate: SqliteValidate,
  takenNames: ReadonlySet<string> = new Set(),
): Promise<StorageGraphEntityDescriptor[]> {
  const idNames = sqliteIdNames(databases, takenNames);
  const results = databases.flatMap((database) =>
    database.tables.map((schema) => ({
      descriptor: buildSqliteDescriptor(
        packageName,
        idNames.get(database.path) ?? database.name,
        database.path,
        schema.table,
        [...schema.columns],
        [...schema.indexes],
        [...schema.foreignKeys],
        database.openPath?.(schema.table.name),
      ),
      diagnostic: diagnosticOf(database, schema),
    })),
  );
  const diagnostics = results.map((result) => result.diagnostic);
  const logicalReferences = await discoverLogicalSqliteReferences(diagnostics, validate);
  const descriptors = results.map((result) => {
    const references = logicalReferences.filter(
      (reference) =>
        reference.source.databasePath === result.diagnostic.databasePath &&
        reference.source.table === result.diagnostic.table,
    );
    return {
      ...result.descriptor,
      fields: result.descriptor.fields.map((field) => {
        const reference = references.find((candidate) => candidate.sourceColumn === field.name);
        if (!reference || field.references) return field;
        return {
          ...field,
          references: {
            targetNodeId: makeGraphId(
              "sqlite",
              packageName,
              idNames.get(result.diagnostic.databasePath) ?? result.diagnostic.database,
              reference.table,
            ),
            targetFieldName: reference.primaryKey,
            relationshipKind: "logical-reference" as const,
          },
        };
      }),
    };
  });
  logSqliteSchemaDiagnostics(packageName, descriptors, diagnostics);
  return descriptors;
}
