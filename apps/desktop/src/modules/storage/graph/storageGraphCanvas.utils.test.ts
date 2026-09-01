import { expect, test } from "vite-plus/test";
import {
  getStorageGraphClusterTitle,
  isStorageGraphRouteAttached,
} from "./storageGraphCanvas.utils";

test("cluster titles use the most common first table-name word", () => {
  expect(
    getStorageGraphClusterTitle([
      "equipment",
      "equipment_type",
      "equipment_log",
      "loyalty_equipment_link",
    ]),
  ).toBe("Equipment");
});

test("cluster titles have a stable fallback", () => {
  expect(getStorageGraphClusterTitle(["", "___"])).toBe("Cluster");
});

test("routed edges are accepted only while both ends touch their current tables", () => {
  const source = { position: { x: 100, y: 100 }, width: 280, height: 244 };
  const target = { position: { x: 700, y: 300 }, width: 280, height: 244 };
  const attachedRoute = [
    { x: 381, y: 180 },
    { x: 520, y: 180 },
    { x: 520, y: 380 },
    { x: 699, y: 380 },
  ];

  expect(isStorageGraphRouteAttached(attachedRoute, source, target)).toBe(true);
  expect(
    isStorageGraphRouteAttached(attachedRoute, { ...source, position: { x: 350, y: 600 } }, target),
  ).toBe(false);
});
