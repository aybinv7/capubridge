# Effect Layer

Effect is used for the **runtime/control plane**. It wraps Tauri IPC, event streams, and WebSocket transport.## invoke wrappers

````typescript
// runtime/effect/tauri.ts
import { Effect, Schema } from 'effect';
export const invokeEffect = <A, I>(command: string) => (params?: I) =>
  Effect.tryPromise({
    try: () => invoke<A>(command, params),
    catch: TauriInvokeError,
  });
```## Event wrappers
```typescript
// runtime/effect/events.ts
export const listenEffect = <E>(event: string) =>
  Stream.effect<Event<E>, TauriListenError>({ /* ... */ });
```## Cancellation
```typescript
// runtime/effect/cancellation.ts
export const withTimeout = <A>(ms: number) => <E>(effect: Effect<E, A>) =>
  Effect.zipRight(Effect.sleep(ms), effect, { /* ... */ });
```## Layer composition
```typescript
// runtime/effect/layers.ts
export const TauriLayer = Layer.provide(
  invokeLayer,
  listenLayer,
  wsLayer,
  CacheLayer,
);
````
