import {
  inject,
  provide,
  type InjectionKey,
  type Ref,
  type ShallowRef,
} from 'vue';

/**
 * Shared state container behind the `*Root` / `*Trigger` / `*Close` compounds.
 *
 * `Popover` also publishes the anchor element its `Trigger` registers, so a sibling `Popover`
 * can anchor against it. `Dialog` leaves `anchor` untouched — dialogs are centered on the
 * viewport, not anchored.
 */
export interface OverlayRootContext {
  anchor: ShallowRef<HTMLElement | undefined>;
  open: Readonly<Ref<boolean>>;
  setOpen: (open: boolean) => void;
}

export const popoverRootContextKey: InjectionKey<OverlayRootContext> =
  Symbol('cladd-popover-root');

export const dialogRootContextKey: InjectionKey<OverlayRootContext> =
  Symbol('cladd-dialog-root');

export const popupRootContextKey: InjectionKey<OverlayRootContext> =
  Symbol('cladd-popup-root');

export const toastRootContextKey: InjectionKey<OverlayRootContext> =
  Symbol('cladd-toast-root');

export function provideOverlayRootContext(
  key: InjectionKey<OverlayRootContext>,
  context: OverlayRootContext,
): void {
  provide(key, context);
}

export function useOverlayRootContext(
  key: InjectionKey<OverlayRootContext>,
): OverlayRootContext | undefined {
  return inject(key, undefined);
}
