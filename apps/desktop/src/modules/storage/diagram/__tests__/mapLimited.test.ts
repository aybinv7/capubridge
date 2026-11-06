import { expect, test } from "vite-plus/test";
import { mapLimited } from "../mapLimited";

test("keeps the input order with at most the limit in flight", async () => {
  let inFlight = 0;
  let most = 0;
  const result = await mapLimited([30, 5, 20, 1, 10], 2, async (delay, index) => {
    inFlight += 1;
    most = Math.max(most, inFlight);
    await new Promise((resolve) => setTimeout(resolve, delay));
    inFlight -= 1;
    return index;
  });
  expect(result).toEqual([0, 1, 2, 3, 4]);
  expect(most).toBe(2);
});

test("stops starting new calls after a failure and rejects with it", async () => {
  const started: number[] = [];
  await expect(
    mapLimited([1, 2, 3, 4], 1, async (value) => {
      started.push(value);
      if (value === 2) throw new Error("table 2 is unreadable");
      return value;
    }),
  ).rejects.toThrow("table 2 is unreadable");
  expect(started).toEqual([1, 2]);
});

test("an empty list maps to an empty list", async () => {
  expect(await mapLimited([], 4, async () => 1)).toEqual([]);
});
