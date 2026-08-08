import {
  computed,
  inject,
  provide,
  toValue,
  type InjectionKey,
  type MaybeRefOrGetter,
  type Ref,
} from "vue";

import type { ComponentDefaults } from "../foundations/componentDefaults.ts";
import type { UiAccent, UiTheme } from "../foundations/contracts.ts";

/** Upstream default: `'#app, #__next, #root'` — the first match wins. */
export const defaultOverlaysRoot = "#app, #__next, #root";

export interface UiContextValue {
  accentColor: Readonly<Ref<UiAccent>>;
  defaults: Readonly<Ref<ComponentDefaults>>;
  overlaysRoot: Readonly<Ref<string>>;
  theme: Readonly<Ref<UiTheme>>;
}

const uiContextKey: InjectionKey<UiContextValue> = Symbol("cui-context");

const defaultUiContext: UiContextValue = {
  accentColor: computed(() => "brand"),
  defaults: computed(() => ({})),
  overlaysRoot: computed(() => defaultOverlaysRoot),
  theme: computed(() => "dark"),
};

export interface ProvideUiContextOptions {
  accentColor: MaybeRefOrGetter<UiAccent>;
  defaults?: MaybeRefOrGetter<ComponentDefaults | undefined>;
  overlaysRoot?: MaybeRefOrGetter<string | undefined>;
  theme: MaybeRefOrGetter<UiTheme>;
}

export function provideUiContext(options: ProvideUiContextOptions): UiContextValue {
  const value: UiContextValue = {
    accentColor: computed(() => toValue(options.accentColor)),
    defaults: computed(() => toValue(options.defaults) ?? {}),
    overlaysRoot: computed(() => toValue(options.overlaysRoot) ?? defaultOverlaysRoot),
    theme: computed(() => toValue(options.theme)),
  };

  provide(uiContextKey, value);
  return value;
}

export function useUiContext(): UiContextValue {
  return inject(uiContextKey, defaultUiContext);
}

/** Upstream `useTheme()`. */
export function useTheme(): Readonly<Ref<UiTheme>> {
  return useUiContext().theme;
}

/** Upstream `useAccentColor()`. */
export function useAccentColor(): Readonly<Ref<UiAccent>> {
  return useUiContext().accentColor;
}

/** Upstream `useOverlaysRoot()`. */
export function useOverlaysRoot(): Readonly<Ref<string>> {
  return useUiContext().overlaysRoot;
}
