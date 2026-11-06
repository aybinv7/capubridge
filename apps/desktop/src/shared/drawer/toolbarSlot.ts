import { inject, provide, shallowRef, type InjectionKey, type ShallowRef } from "vue";

/**
 * Where a drawer view puts its controls: the middle of the drawer's one header row, between the
 * view switch and the window actions. The host (drawer or pop-out window) provides the element;
 * views teleport into it, so a gated view leaves the header with just the host's own controls.
 */
const TOOLBAR_SLOT: InjectionKey<ShallowRef<HTMLElement | null>> = Symbol("drawer-toolbar-slot");

/** Called by a drawer host; bind the returned ref to the header's middle element. */
export function provideDrawerToolbarSlot(): ShallowRef<HTMLElement | null> {
  const slot = shallowRef<HTMLElement | null>(null);
  provide(TOOLBAR_SLOT, slot);
  return slot;
}

/** Called by a drawer view: the element to teleport its toolbar into, once it exists. */
export function useDrawerToolbarSlot(): ShallowRef<HTMLElement | null> {
  return inject(TOOLBAR_SLOT, shallowRef(null));
}

/** Where a drawer view lives: the main window's drawer, or a window of its own. */
export type DrawerHost = "drawer" | "window";

const HOST: InjectionKey<DrawerHost> = Symbol("drawer-host");

export function provideDrawerHost(host: DrawerHost) {
  provide(HOST, host);
}

/**
 * The host of the calling view. A window of its own has no timeline and no section to open a
 * request in, so views leave those actions out there.
 */
export function useDrawerHost(): DrawerHost {
  return inject(HOST, "drawer");
}
