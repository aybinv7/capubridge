import type { OverlayRootProps } from './overlayRoot.ts';
export const toastSurfaceClasses =
  'cladd-toast fixed right-safe-4 bottom-safe-4 z-50 max-w-full origin-bottom rounded-cladd-toast';

export const toastHiddenClasses =
  'translate-y-4 scale-75 opacity-0 duration-200 ease-out!';

/**
 * The stacking behaviour is pure CSS: each toast reacts to how many un-closing toasts follow it,
 * shrinking and sliding up a step per sibling and hiding past the third.
 */
export const toastOpenedClasses =
  'scale-100 opacity-100 duration-500 ease-[cubic-bezier(0,1,0.2,1.1)] has-[+.cladd-toast+.cladd-toast+.cladd-toast:not(.toast-closing)]:opacity-0 has-[+.cladd-toast+.cladd-toast:not(.toast-closing)]:-translate-y-8 has-[+.cladd-toast+.cladd-toast:not(.toast-closing)]:scale-80 has-[+.cladd-toast:not(.toast-closing)]:origin-top has-[+.cladd-toast:not(.toast-closing)]:-translate-y-4 has-[+.cladd-toast:not(.toast-closing)]:scale-90';

export const toastClosingClasses = 'toast-closing';

export const toastContentClasses = 'flex items-center gap-4 py-2 pl-4';

export const toastContentWithBothClasses = 'py-3';

export const toastContentWithOneClasses = 'py-2';

export const toastContentCloseButtonClasses = 'pr-2';

export const toastContentNoCloseButtonClasses = 'pr-4';

export const toastIconClasses =
  'flex shrink-0 items-center [&>svg]:size-4 [&>svg]:shrink-0';

export const toastCopyClasses = 'flex flex-col';

export const toastTitleClasses = 'text-cladd-sm font-semibold';

export const toastTextClasses = 'text-cladd-xs leading-relaxed';

export const toastCloseWrapperClasses = 'ml-auto';

export const toastDefaultTimeout = 5000;

/** Stateful, non-visual root that owns a `Toast`'s open state. */
export type ToastRootProps = OverlayRootProps;

/** Takes no own props; upstream's are the native element props plus `children` and `ref`. */
export type ToastTriggerProps = Record<string, never>;

/** Takes no own props; upstream's are the native element props plus `children` and `ref`. */
export type ToastCloseProps = Record<string, never>;
