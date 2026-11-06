import { describe, expect, it } from "vite-plus/test";
import { createSerialQueue } from "@/lib/serial-queue";

function deferred() {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("createSerialQueue", () => {
  it("runs tasks in call order without overlap", async () => {
    const queue = createSerialQueue();
    const log: string[] = [];
    const gate = deferred();

    const first = queue.run(async () => {
      log.push("stop:start");
      await gate.promise;
      log.push("stop:end");
    });
    const second = queue.run(async () => {
      log.push("start");
    });

    await Promise.resolve();
    expect(log).toEqual(["stop:start"]);
    gate.resolve();
    await Promise.all([first, second]);
    expect(log).toEqual(["stop:start", "stop:end", "start"]);
  });

  it("keeps going after a failed task and still reports the failure", async () => {
    const queue = createSerialQueue();
    const failed = queue.run(async () => {
      throw new Error("adb went away");
    });
    const next = queue.run(async () => "ok");

    await expect(failed).rejects.toThrow("adb went away");
    await expect(next).resolves.toBe("ok");
  });
});
