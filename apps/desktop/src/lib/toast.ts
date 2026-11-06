import { h, markRaw, shallowRef, type Component, type VNodeChild } from "vue";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-vue-next";
import { Button, Spinner } from "@capubridge/cladd";

/** A toast as Cladd draws it, plus the key the list renders by. */
export interface AppToastEntry {
  key: string;
  id: ToastId;
  title?: VNodeChild;
  text?: VNodeChild;
  color?: "neutral" | "green" | "red" | "yellow" | "blue";
  icon?: Component;
  iconProps?: Record<string, unknown>;
  timeout: number;
  closeButton: boolean;
  open: boolean;
  onClosed?: () => void;
}

export type ToastId = string | number;

export interface ToastAction {
  label: string;
  onClick: (event: MouseEvent) => void;
}

export interface ToastOptions {
  id?: ToastId;
  description?: VNodeChild;
  /** Milliseconds before it closes; `Infinity` or `0` keeps it until dismissed. */
  duration?: number;
  action?: ToastAction;
  /** A quiet second button beside the action. */
  cancel?: ToastAction;
  onDismiss?: () => void;
  onAutoClose?: () => void;
}

export interface CustomToastOptions {
  id?: ToastId;
  duration?: number;
  componentProps?: object;
}

export interface PromiseToastMessages<T> {
  loading: VNodeChild;
  success: VNodeChild | ((value: T) => VNodeChild);
  error: VNodeChild | ((error: unknown) => VNodeChild);
  description?: VNodeChild;
}

type Kind = "success" | "error" | "info" | "warning" | "loading" | "message";

const DEFAULT_TIMEOUT = 4000;
const ERROR_TIMEOUT = 6000;

const KIND_STYLE: Record<Kind, Pick<AppToastEntry, "color" | "icon" | "iconProps">> = {
  success: { color: "green", icon: markRaw(CircleCheck) },
  error: { color: "red", icon: markRaw(CircleAlert) },
  warning: { color: "yellow", icon: markRaw(TriangleAlert) },
  info: { color: "neutral", icon: markRaw(Info) },
  loading: { color: "neutral", icon: markRaw(Spinner), iconProps: { size: "xs" } },
  message: { color: "neutral" },
};

/** Every toast on screen, newest last. `AppToasts` renders it with Cladd's `Toast`. */
export const toastEntries = shallowRef<AppToastEntry[]>([]);

let counter = 0;

function nextKey(): string {
  counter += 1;
  return `toast-${counter}`;
}

function timeoutOf(kind: Kind, duration: number | undefined): number {
  if (kind === "loading") return 0;
  if (duration === undefined) return kind === "error" ? ERROR_TIMEOUT : DEFAULT_TIMEOUT;
  return Number.isFinite(duration) ? Math.max(0, duration) : 0;
}

function actionButton(action: ToastAction, variant: "solid" | "transparent", close: () => void) {
  return h(
    Button,
    {
      size: "xs",
      variant,
      onClick: (event: MouseEvent) => {
        action.onClick(event);
        close();
      },
    },
    () => action.label,
  );
}

function body(options: ToastOptions | undefined, close: () => void): VNodeChild {
  const description = options?.description;
  const action = options?.action;
  const cancel = options?.cancel;
  if (!action && !cancel) return description;
  return h("span", { class: "flex flex-col items-start gap-2" }, [
    description ? h("span", null, [description]) : null,
    h("span", { class: "flex items-center gap-1.5" }, [
      action ? actionButton(action, "solid", close) : null,
      cancel ? actionButton(cancel, "transparent", close) : null,
    ]),
  ]);
}

function closeEntries(match: (entry: AppToastEntry) => boolean) {
  let changed = false;
  const next = toastEntries.value.map((entry) => {
    if (!entry.open || !match(entry)) return entry;
    changed = true;
    return { ...entry, open: false };
  });
  if (changed) toastEntries.value = next;
}

function show(kind: Kind, title: VNodeChild, options?: ToastOptions): ToastId {
  const id = options?.id ?? nextKey();
  closeEntries((entry) => entry.id === id);
  const key = nextKey();
  const entry: AppToastEntry = {
    key,
    id,
    title,
    text: body(options, () => dismiss(id)),
    ...KIND_STYLE[kind],
    timeout: timeoutOf(kind, options?.duration),
    closeButton: true,
    open: true,
    onClosed: options?.onDismiss ?? options?.onAutoClose,
  };
  toastEntries.value = [...toastEntries.value, entry];
  return id;
}

/** Closes the toast `id`, or every toast when no id is given. */
export function dismiss(id?: ToastId) {
  closeEntries((entry) => id === undefined || entry.id === id);
}

/** Drops a toast whose close transition has finished. */
export function forgetToast(key: string) {
  const entry = toastEntries.value.find((candidate) => candidate.key === key);
  toastEntries.value = toastEntries.value.filter((candidate) => candidate.key !== key);
  entry?.onClosed?.();
}

/** Marks a toast closed when Cladd closes it (its timeout or its close button). */
export function setToastOpen(key: string, open: boolean) {
  toastEntries.value = toastEntries.value.map((entry) =>
    entry.key === key ? { ...entry, open } : entry,
  );
}

function resolveMessage<T>(message: VNodeChild | ((value: T) => VNodeChild), value: T): VNodeChild {
  return typeof message === "function" ? (message as (value: T) => VNodeChild)(value) : message;
}

/**
 * The toasts of the whole app, with the call shapes the app already uses: a title, then
 * options (`description`, `duration`, `id` to replace a toast, `action`). Drawn with Cladd's
 * Toast by `AppToasts`.
 */
export const toast = Object.assign(
  (title: VNodeChild, options?: ToastOptions) => show("message", title, options),
  {
    success: (title: VNodeChild, options?: ToastOptions) => show("success", title, options),
    error: (title: VNodeChild, options?: ToastOptions) => show("error", title, options),
    info: (title: VNodeChild, options?: ToastOptions) => show("info", title, options),
    warning: (title: VNodeChild, options?: ToastOptions) => show("warning", title, options),
    loading: (title: VNodeChild, options?: ToastOptions) => show("loading", title, options),
    message: (title: VNodeChild, options?: ToastOptions) => show("message", title, options),
    dismiss,
    /** A component as the whole toast body (`componentProps` are its props). */
    custom(component: Component, options?: CustomToastOptions): ToastId {
      const id = options?.id ?? nextKey();
      closeEntries((entry) => entry.id === id);
      const entry: AppToastEntry = {
        key: nextKey(),
        id,
        text: h(markRaw(component), { ...options?.componentProps }),
        color: "neutral",
        timeout: timeoutOf("message", options?.duration),
        closeButton: true,
        open: true,
      };
      toastEntries.value = [...toastEntries.value, entry];
      return id;
    },
    /** A loading toast that becomes success or error when `promise` settles. */
    promise<T>(promise: Promise<T>, messages: PromiseToastMessages<T>): ToastId {
      const id = show("loading", messages.loading, { description: messages.description });
      promise.then(
        (value) => show("success", resolveMessage(messages.success, value), { id }),
        (error: unknown) => show("error", resolveMessage(messages.error, error), { id }),
      );
      return id;
    },
  },
);
