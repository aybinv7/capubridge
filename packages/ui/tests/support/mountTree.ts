import { createApp, type App, type VNode } from "vue";

export interface MountedTree {
  app: App;
  root: HTMLDivElement;
}

/**
 * Mounts into a `#app` container, because overlays teleport into the context `overlaysRoot`
 * (upstream's `'#app, #__next, #root'`) and a Cladd app owns that element, not the library.
 */
export function mountTree(vnode: VNode, warnHandler?: (message: string) => void): MountedTree {
  const root = document.createElement("div");
  root.id = "app";
  document.body.append(root);
  const app = createApp({ render: () => vnode });

  if (warnHandler) {
    app.config.warnHandler = warnHandler;
  }

  app.mount(root);
  return { app, root };
}

export function byTestId(root: HTMLElement, id: string): HTMLElement {
  const element = root.querySelector<HTMLElement>(`[data-testid="${id}"]`);

  if (!element) {
    throw new Error(`Missing test element: ${id}`);
  }

  return element;
}
