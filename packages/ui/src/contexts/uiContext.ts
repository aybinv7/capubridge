import {
  computed,
  inject,
  provide,
  toValue,
  type InjectionKey,
  type MaybeRefOrGetter,
  type Ref,
} from "vue";

import type { UiAccent, UiTheme } from "../foundations/contracts.ts";

interface UiContextValue {
  accent: Readonly<Ref<UiAccent>>;
  theme: Readonly<Ref<UiTheme>>;
}

const uiContextKey: InjectionKey<UiContextValue> = Symbol("cui-context");
const defaultUiContext: UiContextValue = {
  accent: computed(() => "brand"),
  theme: computed(() => "dark"),
};

export function provideUiContext(
  theme: MaybeRefOrGetter<UiTheme>,
  accent: MaybeRefOrGetter<UiAccent>,
): UiContextValue {
  const value: UiContextValue = {
    accent: computed(() => toValue(accent)),
    theme: computed(() => toValue(theme)),
  };

  provide(uiContextKey, value);
  return value;
}

export function useUiContext(): UiContextValue {
  return inject(uiContextKey, defaultUiContext);
}
