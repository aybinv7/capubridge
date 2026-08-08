export const focusTrapFocusableSelectors = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  'input:not([disabled]):not([type="hidden"])',
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
  "audio[controls]",
  "video[controls]",
  "iframe",
  "object",
  "embed",
  "summary",
] as const;

export const focusTrapFocusableSelector = focusTrapFocusableSelectors.join(",");

export const focusTrapTopmostModalSelector = ".cui-dialog, .cui-popup";

interface FocusTrapDisableable {
  disabled?: boolean;
}

interface FocusTrapVisibilityCheckable {
  checkVisibility?: () => boolean;
}

function isDisabled(element: HTMLElement): boolean {
  return (element as FocusTrapDisableable).disabled === true;
}

function checkNativeVisibility(element: HTMLElement): boolean | undefined {
  const checkable = element as FocusTrapVisibilityCheckable;
  if (typeof checkable.checkVisibility !== "function") return undefined;
  return checkable.checkVisibility();
}

function hasLayoutBox(element: HTMLElement): boolean {
  return Boolean(element.offsetWidth || element.offsetHeight || element.getClientRects().length);
}

export function isFocusTrapVisible(element: HTMLElement): boolean {
  if (element.hidden) return false;
  if (isDisabled(element)) return false;
  if (element.getAttribute("aria-hidden") === "true") return false;
  return checkNativeVisibility(element) ?? hasLayoutBox(element);
}

export function getFocusTrapFocusable(container: HTMLElement): HTMLElement[] {
  const nodes = Array.from(container.querySelectorAll<HTMLElement>(focusTrapFocusableSelector));
  return nodes.filter(isFocusTrapVisible);
}

export function isTopmostModalLayer(container: HTMLElement): boolean {
  const modals = container.ownerDocument.querySelectorAll(focusTrapTopmostModalSelector);
  if (modals.length === 0) return true;
  const last = modals[modals.length - 1];
  return last === container || container.contains(last);
}
