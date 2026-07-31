# Framework DevTools (Vue & React)

Capubridge runs the **official** Vue and React DevTools against a real Android
WebView. The DevTools UI is hosted in the Inspect panel; the matching backend is
injected into the target page and the two talk over the CDP connection.

Each framework is an adapter under `src/modules/inspect/<framework>-devtools/`,
registered in `plugins/init.ts`. The tab only appears when the framework is
actually detected on the selected target.

---

## The one thing that decides whether it works

Both frameworks strip devtools support from production builds. **The target app
has to be built to allow inspection** — nothing capubridge does can recover
information the bundler removed.

|                                      | Vue                   | React                               |
| ------------------------------------ | --------------------- | ----------------------------------- |
| Component tree in a production build | ❌ needs a build flag | ✅ works                            |
| Readable component names             | dev build             | dev build (prod names are minified) |
| Profiler                             | n/a                   | ❌ needs dev or profiling build     |

### Vue — `__VUE_PROD_DEVTOOLS__`

A stock production Vue build is **completely uninspectable**. Vue gates three
things behind the same compile-time flag, and with it off all three vanish:

- `app._instance` is never assigned
- `app:init` is never emitted, so the DevTools hook records zero apps
- `__vnode` / `__vueParentComponent` are never attached to DOM elements

Add the define to the target app's Vite config — staging builds only:

```ts
// vite.config.ts of the app being debugged (Presalio, Efficy, …)
export default defineConfig({
  define: {
    __VUE_PROD_DEVTOOLS__: true,
  },
});
```

Rebuild and reinstall. Without it the panel says so explicitly rather than
spinning, and reports which signals are missing.

### React — no flag needed

`react-dom` keeps fiber back-references on DOM nodes and calls
`__REACT_DEVTOOLS_GLOBAL_HOOK__` in production too, so **the Components tab
works against a stock production build**. Two caveats:

- Component names are **minified** in a production build.
- The **Profiler tab will refuse to run**: "Profiling support requires either a
  development or profiling build of React v16.5+". That is React declining, not
  a capubridge failure — the timing instrumentation is compiled out.

For readable names and a working Profiler, run the app from a dev server:

```bash
ionic cap run android -l --external
```

For something closer to production, alias `react-dom/profiling` in the target
app's bundler.

---

## How it works

Both adapters follow the same shape:

1. **Detect** — is the framework present on this target?
   - Vue: `__vue_app__` on a DOM element, or the devtools hook.
   - React: the fiber keys `react-dom` attaches to DOM nodes
     (`__reactFiber$…`, `__reactContainer$…`). _Not_ the global hook — React
     never creates that, DevTools does.
2. **Probe** — is it actually inspectable? Reports version, build type and which
   devtools signals survived, so a blocked target explains itself.
3. **Inject at document start** and reload. Both frameworks read the hook **once
   as they load**, so a backend injected into an already-running page is inert.
   Vue additionally nulls its `__VUE_DEVTOOLS_HOOK_REPLAY__` after ~3s.
4. **Bridge over CDP** — the target sends via a `Runtime.addBinding` callback;
   the host delivers via `Runtime.evaluate`.

### Why CDP and not a WebSocket

React's backend accepts `connectToDevTools({ websocket })` and Vue's birpc layer
accepts a custom `channel`, so a direct socket looks attractive. It does not
work on Android: a WebView on `https://localhost` _may_ construct
`ws://localhost` — Chrome exempts loopback from the mixed-content block — but
Android then refuses the connection with `ERR_CLEARTEXT_NOT_PERMITTED` under
targetSdk 28+. A probe server never receives a TCP connection at all. Making it
work would require a cleartext exception in **every debugged app's manifest**,
so both adapters use the CDP channel, which needs no app changes.

### Injection must be idempotent

Re-injecting a devtools runtime stacks a second set of subscriptions. Because
each init both emits _and_ subscribes, N inits cost **N×N** deliveries per
update. Measured on a real device before the guard existed: 4/9/16/25 trees for
2/3/4/5 inits, and a session that had accumulated ~20 inits pushed **38 MB for a
single tap**. With the guard, the same interaction costs ~0.16 MB. Both runtimes
therefore set an `…Installed` flag and return early, while still announcing
readiness so the host handshake completes.

---

## Troubleshooting

**The panel hangs on "Checking the … runtime"** — the target app is probably
backgrounded. Android freezes a backgrounded app's process, which stops it
answering CDP entirely. Foreground the app and retry.

**Vue: "This build has Vue DevTools stripped out"** — the target lacks
`__VUE_PROD_DEVTOOLS__`. See above.

**React: Components works but the tree is empty after a manual reload** — the
backend flushes the initial tree when _it_ connects. The adapter attaches the UI
before booting the backend for this reason; a stray reload outside that sequence
can still race it. Hit Retry.

**React: "Profiling not supported"** — expected on a production build. Not a bug.
