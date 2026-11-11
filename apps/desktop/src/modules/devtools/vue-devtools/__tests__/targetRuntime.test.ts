import { describe, test, expect } from "vite-plus/test";
import { buildTargetRuntimeSource } from "../targetRuntime";

describe("buildTargetRuntimeSource", () => {
  const source = buildTargetRuntimeSource();

  test("patches the official runtime bundle", () => {
    expect(source.length).toBeGreaterThan(100_000);
    expect(source).toContain("__capubridgeVueDevtoolsBinding");
  });

  test("initialises devtools-kit exactly once per document", () => {
    // Re-injection used to stack a whole devtools-kit init each time. Because
    // every init both emits and subscribes, N inits cost N*N deliveries per
    // update — measured at 4/9/16/25 trees for 2/3/4/5 inits on a real device,
    // which is how a single tap grew to 392 trees and 38MB.
    const guard = source.indexOf("__capubridgeVueDevtoolsInstalled");
    const init = source.indexOf("_t.init()");

    expect(guard).toBeGreaterThan(-1);
    expect(init).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(init);
    expect(source).toContain("if(t[g1]){d();return}");
  });

  test("still reports readiness when re-injected into an installed page", () => {
    // The early return must announce readiness, or the host handshake stalls.
    const guardReturn = source.indexOf("if(t[g1]){d();return}");
    const readySender = source.indexOf("function d(){");
    expect(readySender).toBeGreaterThan(-1);
    expect(readySender).toBeLessThan(guardReturn);
    expect(source).toContain("__capubridgeVueDevtoolsReady");
  });
});
