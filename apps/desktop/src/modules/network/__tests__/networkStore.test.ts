import { beforeEach, describe, expect, test, vi } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import { useNetworkStore } from "../stores/useNetworkStore";
import { networkEntry } from "./fixtures";

beforeEach(() => {
  setActivePinia(createPinia());
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
});

describe("network store", () => {
  test("the selected request follows its updates", () => {
    const store = useNetworkStore();
    store.addEntry(networkEntry({ requestId: "1", state: "pending", httpStatus: null }));
    store.select("1");
    expect(store.selectedEntry?.state).toBe("pending");

    store.patchEntry("1", { state: "finished", httpStatus: 200 });

    expect(store.selectedEntry?.state).toBe("finished");
    expect(store.selectedEntry?.httpStatus).toBe(200);
  });

  test("the WebSocket filter still applies the text filter", () => {
    const store = useNetworkStore();
    store.addEntry(
      networkEntry({ requestId: "chat", url: "wss://a.test/chat", isWebSocket: true }),
    );
    store.addEntry(
      networkEntry({ requestId: "feed", url: "wss://a.test/feed", isWebSocket: true }),
    );
    store.addEntry(networkEntry({ requestId: "api", url: "https://a.test/chat" }));

    store.typeFilter = "WS";
    store.filterText = "chat";

    expect(store.filteredEntries.map((entry) => entry.requestId)).toEqual(["chat"]);
  });

  test("searching headers needs the wider scope", () => {
    const store = useNetworkStore();
    store.addEntry(
      networkEntry({ requestId: "1", requestHeaders: { Authorization: "Bearer secret-token" } }),
    );
    store.filterText = "secret-token";

    expect(store.filteredEntries).toHaveLength(0);
    store.searchScope = "all";
    expect(store.filteredEntries).toHaveLength(1);
  });

  test("searching bodies finds only bodies that were read", () => {
    const store = useNetworkStore();
    store.addEntry(networkEntry({ requestId: "1" }));
    store.searchScope = "all";
    store.filterText = "needle";
    expect(store.filteredEntries).toHaveLength(0);

    store.cacheBody("1", '{"found":"needle"}');

    expect(store.filteredEntries).toHaveLength(1);
  });

  test("clearing filters restores every request", () => {
    const store = useNetworkStore();
    store.addEntry(networkEntry({ requestId: "1", method: "POST" }));
    store.filterText = "nothing";
    store.typeFilter = "Img";
    store.methodFilter = "GET";
    expect(store.hasActiveFilters).toBe(true);

    store.clearFilters();

    expect(store.hasActiveFilters).toBe(false);
    expect(store.filteredEntries).toHaveLength(1);
  });

  test("clearing the log drops the selection and cached bodies", () => {
    const store = useNetworkStore();
    store.addEntry(networkEntry({ requestId: "1" }));
    store.cacheBody("1", "body");
    store.select("1");

    store.clear();

    expect(store.requestCount).toBe(0);
    expect(store.selectedId).toBeNull();
    expect(store.retainedBodyCount).toBe(0);
  });
});
