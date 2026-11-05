import { describe, expect, it } from "vite-plus/test";
import { queueIconRead } from "../iconQueue";

function deferred() {
  let resolve: (value: string) => void = () => undefined;
  const promise = new Promise<string>((done) => (resolve = done));
  return { promise, resolve };
}

describe("queueIconRead", () => {
  it("runs at most three reads at once, newest first, and drops rows that went away", async () => {
    const started: string[] = [];
    const gates = new Map<string, ReturnType<typeof deferred>>();
    const read = (name: string, signal?: AbortSignal) => {
      const gate = deferred();
      gates.set(name, gate);
      return queueIconRead(() => {
        started.push(name);
        return gate.promise;
      }, signal);
    };

    const first = ["a", "b", "c"].map((name) => read(name));
    const gone = new AbortController();
    const dropped = read("d", gone.signal);
    const last = read("e");
    expect(started).toEqual(["a", "b", "c"]);

    gone.abort();
    await expect(dropped).rejects.toThrow("Icon request dropped");

    gates.get("a")?.resolve("icon-a");
    await expect(first[0]).resolves.toBe("icon-a");
    expect(started).toEqual(["a", "b", "c", "e"]);

    for (const name of ["b", "c", "e"]) gates.get(name)?.resolve(`icon-${name}`);
    await Promise.all([...first, last]);
  });
});
