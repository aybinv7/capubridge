import { expect, test } from "vite-plus/test";
import type { SqliteColumnInfo } from "@/types/sqlite.types";
import { sqliteDiagramEntities } from "../sqliteDiagramEntities";

function column(name: string, pk = 0): SqliteColumnInfo {
  return { cid: 0, name, colType: "INTEGER", notnull: false, defaultValue: null, pk };
}

test("one database's tables, linked by declared keys and by *_id columns the data confirms", async () => {
  const queries: string[] = [];
  const entities = await sqliteDiagramEntities(
    "com.shop",
    [
      {
        name: "shop.db",
        path: "opfs:/shop.db",
        openPath: (table) => `/storage/sqlite/opfs%3A%2Fshop.db/${table}`,
        tables: [
          {
            table: { name: "customers", rowCount: 2 },
            columns: [column("id", 1)],
            indexes: [],
            foreignKeys: [],
          },
          {
            table: { name: "orders", rowCount: 5 },
            columns: [column("id", 1), column("customer_id")],
            indexes: [{ name: "ix", unique: false, columns: ["customer_id"], sql: null }],
            foreignKeys: [],
          },
        ],
      },
    ],
    async (path, sql) => {
      queries.push(`${path} ${sql}`);
      return { rows: [[4, 4]] };
    },
  );
  expect(entities.map((entity) => entity.openPath)).toEqual([
    "/storage/sqlite/opfs%3A%2Fshop.db/customers",
    "/storage/sqlite/opfs%3A%2Fshop.db/orders",
  ]);
  const link = entities[1]?.fields.find((field) => field.name === "customer_id")?.references;
  expect(link?.relationshipKind).toBe("logical-reference");
  expect(link?.targetNodeId).toBe(entities[0]?.id);
  expect(entities[0]?.groupKey).toBe("sqlite:opfs:/shop.db");
  expect(queries).toHaveLength(1);
  expect(queries[0]).toMatch(/^opfs:\/shop\.db SELECT COUNT/);
});
