# Composables

Shared logic hooks — named `use*`, always exported.

## Core composables

### useCDP

Manages the CDP WebSocket connection to a target.

```typescript
// apps/desktop/src/composables/useCDP.ts
export function useCDP(targetId: Ref<string>) {
  const connectionStore = useConnectionStore();
  const ws = computed(() => connectionStore.ws);
  async function send<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T> {
    /* ... */
  }
  async function eval<T = unknown>(expression: string): Promise<T> {
    /* ... */
  }
  return { ws, send, eval };
}
```

### useIDB

IndexedDB operations through CDP.

```typescript
// apps/desktop/src/composables/useIDB.ts
export function useIDB(targetId: Ref<string>) {
  async function getDatabaseNames(): Promise<string[]> {
    /* ... */
  }
  async function getObjectStores(dbName: string): Promise<IDBObjectStoreMeta[]> {
    /* ... */
  }
  async function getRecords(params: GetRecordsParams): Promise<IDBRecord[]> {
    /* ... */
  }
  async function putRecord(dbName: string, storeName: string, record: unknown): Promise<void> {
    /* ... */
  }
  async function deleteRecord(dbName: string, storeName: string, key: IDBValidKey): Promise<void> {
    /* ... */
  }
  return { getDatabaseNames, getObjectStores, getRecords, putRecord, deleteRecord };
}
```

### useAppPackages

App package listing from dumpsys.

```typescript
// apps/desktop/src/composables/useAppPackages.ts
export function useAppPackages(serial: Ref<string>) {
  const packages = ref<AppPackage[]>([]);
  const isLoading = ref(false);
  async function refresh(scope: "third-party" | "all"): Promise<void> {
    /* ... */
  }
  return { packages, isLoading, refresh };
}
```

## Convention

- All composables are **named exports** starting with `use`
- Accept **Refs** for reactive arguments (not raw values)
- Return **named properties only** (no destructuring that loses context)
- Used by stores and components — not by other composables (except for core infrastructure like `useCDP`)

## Module composables

Each module has its own composables in `modules/<name>/use*.ts`:
| Composable | Module | Used for |
|-------------|--------|----------|
| `useMirrorStream` | mirror | Mirror lease state |
| `useAppPanel` | app | App inspector state |
| `useInspector` | inspect | DOM inspector state |
| `useStorageGraphData` | storage/graph | Graph data fetching |
