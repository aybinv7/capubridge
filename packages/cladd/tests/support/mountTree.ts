import { createApp, nextTick, type App, type VNode } from 'vue';

export interface MountedTree {
  app: App;
  root: HTMLDivElement;
}

/**
 * Mounts into a `#app` container, because overlays teleport into the context `overlaysRoot`
 * (upstream's `'#app, #__next, #root'`) and a Cladd app owns that element, not the library.
 */
export function mountTree(
  vnode: VNode,
  warnHandler?: (message: string) => void,
): MountedTree {
  const root = document.createElement('div');
  root.id = 'app';
  document.body.append(root);
  const app = createApp({ render: () => vnode });

  if (warnHandler) {
    app.config.warnHandler = warnHandler;
  }

  app.mount(root);
  return { app, root };
}

/**
 * Clicks through Vue's event-timestamp guard.
 *
 * `runtime-dom`'s invoker drops any listener whose attach stamp is not strictly older than the
 * event: `e._vts <= invoker.attached` returns without calling it. Both stamps are `Date.now()`,
 * whose granularity is ~15.6 ms on Windows, so a synchronous mount-then-click lands in the same
 * tick and the handler is silently skipped — a real browser click is always tens of ms later.
 * Waiting for the clock to advance makes every click deterministic on every platform.
 *
 * Capture-phase listeners still fire in that case (the first invoker takes the `!e._vts` branch),
 * so a skipped bubble handler looks like a broken component rather than a timing artifact.
 */
export async function click(element: HTMLElement): Promise<void> {
  const start = Date.now();

  while (Date.now() === start) {
    await new Promise((resolve) => setTimeout(resolve, 1));
  }

  element.click();
  await nextTick();
}

export function byTestId(root: HTMLElement, id: string): HTMLElement {
  const element = root.querySelector<HTMLElement>(`[data-testid="${id}"]`);

  if (!element) {
    throw new Error(`Missing test element: ${id}`);
  }

  return element;
}
