# Store Architecture

Pinia setup stores (ref- based state, computed getters, async actions). All stores use the setup syntax — no options object.

## Session store

````typescript
// apps/desktop/src/stores/session.store. ts
export const useSessionStore = defineStore('session', () => {
  // State
  const registry = ref<SessionRegistrySnapshot | null>(null);
  const activeSerial = ref<string | null>(null);
  // Getters
  const activeDevice = computed(() => registry.value?.devices.find(d => d.serial === activeSerial.value));
  const sessionState = computed(() => /* hot/warm/cold */);
  // Actions
  async function setActiveDevice(serial: string) { /* ... */ }
  async function refreshDevices() { /* ... */ }
  return { registry, activeSerial, activeDevice, sessionState, setActiveDevice, refreshDevices };
});
```## Devices store
Intent layer for device-facing commands. Renders device state from session store.```typescript
// apps/desktop/src/stores/devices.store.ts
export const useDevicesStore = defineStore('devices', () => {
  const { registry, activeSerial, setActiveDevice } = useSessionStore();
  const selectedDevice = computed(() => registry.value?.devices.find(d => d.serial === activeSerial.value));
  // Intents
  async function selectDevice(device: ADBDevice) {
    await setActiveDevice(device.serial);
  }
  return { devices, selectedDevice, selectDevice };
});
```## Targets store
```typescript
// apps/desktop/src/stores/targets.store.ts
export const useTargetsStore = defineStore('targets', () => {
  const targets = ref<CDPTarget[]>([]);
  const selectedTarget = ref<CDPTarget | null>(null);
  // Port assignment per device
  const port = computed(() => {
    const index = targets.value.findIndex(t => t.id === selectedTarget.value?.id);
    return 9222 + index;
  });
  return { targets, selectedTarget, port };
});
```## Connection store
CDP WebSocket ownership:```typescript
// apps/desktop/src/stores/connection.store.ts
export const useConnectionStore = defineStore('connection', () => {
  const ws = ref<WebSocket | null>(null);
  const status = ref<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const externalLock = ref(false); // External DevTools lock
  async function connect(targetId: string, port: number) { /* ... */ }
  function disconnect() { /* ... */ }
  return { ws, status, externalLock, connect, disconnect };
});
```## Logcat store
```typescript
// apps/desktop/src/stores/logcat.store.ts
export const useLogcatStore = defineStore('logcat', () => {
  const entries = ref<LogcatEntry[]>([]);
  const isStreaming = ref(false);
  async function startStream(serial: string) { /* ... */ }
  async function stopStream() { /* ... */ }
  function clear() { entries.value = []; }
  return { entries, isStreaming, startStream, stopStream, clear };
});
```## Store composition
Stores compose through each other — never create circular dependencies:```typescript
// In a component
const devicesStore = useDevicesStore();
const targetsStore = useTargetsStore();
const connectionStore = useConnectionStore();
```## Persistence
Only **visual persistence** is stored: last device, last target, sidebar collapsed state. Operational state is **not** persisted — it's rebuilt from the session runtime on startup.
````
