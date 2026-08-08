import { expect, test } from "vite-plus/test";
import { layoutStorageGraphWithElk } from "./storageGraphElkLayout";

test("ELK lays out tables and returns routed relationship points", async () => {
  const result = await layoutStorageGraphWithElk(
    [
      { id: "users", width: 280, height: 244 },
      { id: "orders", width: 280, height: 244 },
      { id: "payments", width: 280, height: 244 },
    ],
    [
      {
        id: "orders-users",
        kind: "foreign-key",
        source: "orders",
        target: "users",
        label: "user_id -> id",
        confidence: "high",
      },
      {
        id: "payments-orders",
        kind: "foreign-key",
        source: "payments",
        target: "orders",
        label: "order_id -> id",
        confidence: "high",
      },
    ],
  );

  expect(Object.keys(result.positions)).toHaveLength(3);
  expect(result.positions.users).not.toEqual(result.positions.orders);
  expect(result.routes["orders-users"]?.length).toBeGreaterThanOrEqual(2);
  expect(result.routes["payments-orders"]?.length).toBeGreaterThanOrEqual(2);
});
