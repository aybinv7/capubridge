import { expect, test } from "vite-plus/test";
import {
  buildStorageGraphNamingFamilies,
  layoutStorageGraphWithElk,
} from "./storageGraphElkLayout";

test("ELK lays out tables and returns routed relationship points", async () => {
  const result = await layoutStorageGraphWithElk(
    [
      { id: "users", name: "users", width: 280, height: 244 },
      { id: "orders", name: "orders", width: 280, height: 244 },
      { id: "payments", name: "payments", width: 280, height: 244 },
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

test("naming families choose the exact shared-prefix table as anchor", () => {
  const families = buildStorageGraphNamingFamilies(
    [
      { id: "equipment", name: "equipment", width: 280, height: 244 },
      { id: "equipment-type", name: "equipment_type", width: 280, height: 244 },
      { id: "equipment-log", name: "equipment_log", width: 280, height: 244 },
      { id: "loyalty", name: "loyalty", width: 280, height: 244 },
      { id: "loyalty-card", name: "loyalty_card", width: 280, height: 244 },
      { id: "loyalty-rule", name: "loyalty_rule", width: 280, height: 244 },
    ],
    [],
  );

  expect(families).toEqual([
    {
      key: "equipment",
      anchorId: "equipment",
      memberIds: ["equipment", "equipment-type", "equipment-log"],
    },
    {
      key: "loyalty",
      anchorId: "loyalty",
      memberIds: ["loyalty", "loyalty-card", "loyalty-rule"],
    },
  ]);
});

test("ELK keeps a naming family together while routing external relationships", async () => {
  const result = await layoutStorageGraphWithElk(
    [
      { id: "equipment", name: "equipment", width: 280, height: 244 },
      { id: "equipment-type", name: "equipment_type", width: 280, height: 244 },
      { id: "equipment-log", name: "equipment_log", width: 280, height: 244 },
      { id: "equipment-file", name: "equipment_file", width: 280, height: 244 },
      { id: "users", name: "users", width: 280, height: 244 },
      { id: "sites", name: "sites", width: 280, height: 244 },
    ],
    [
      {
        id: "equipment-users",
        kind: "field-match",
        source: "equipment",
        target: "users",
        label: "user_id -> id",
        confidence: "medium",
      },
      {
        id: "equipment-log-sites",
        kind: "field-match",
        source: "equipment-log",
        target: "sites",
        label: "site_id -> id",
        confidence: "medium",
      },
    ],
    true,
  );

  const familyPositions = [
    result.positions.equipment,
    result.positions["equipment-type"],
    result.positions["equipment-log"],
    result.positions["equipment-file"],
  ];
  expect(familyPositions.every(Boolean)).toBe(true);
  expect(result.routes["equipment-users"]?.length).toBeGreaterThanOrEqual(2);
  expect(result.routes["equipment-log-sites"]?.length).toBeGreaterThanOrEqual(2);
  expect(
    Math.abs((result.routes["equipment-users"]?.[0]?.x ?? 0) - result.positions.equipment.x - 280),
  ).toBeLessThanOrEqual(1);
  expect(Math.max(...familyPositions.map((position) => position.x))).toBeLessThanOrEqual(
    Math.min(...familyPositions.map((position) => position.x)) + 760,
  );
});
