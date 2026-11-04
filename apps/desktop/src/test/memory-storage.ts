import { vi } from "vite-plus/test";

/**
 * Replaces the global Storage with an in-memory one. Node 25+ ships an
 * experimental `localStorage` global that shadows the DOM test environment's,
 * so tests that persist through localStorage install this explicitly.
 */
export function installMemoryStorage(): Storage {
  const memory = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return memory.size;
    },
    clear: () => memory.clear(),
    getItem: (key) => memory.get(key) ?? null,
    key: (index) => Array.from(memory.keys())[index] ?? null,
    removeItem: (key) => {
      memory.delete(key);
    },
    setItem: (key, value) => {
      memory.set(key, String(value));
    },
  };
  vi.stubGlobal("localStorage", storage);
  return storage;
}
