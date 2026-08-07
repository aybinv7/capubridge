import {
  computed,
  inject,
  provide,
  toValue,
  type InjectionKey,
  type MaybeRefOrGetter,
  type Ref,
} from "vue";

import type { UiAccent } from "../foundations/contracts.ts";

export interface SurfaceContextValue {
  accent: Readonly<Ref<UiAccent | undefined>>;
  level: Readonly<Ref<number>>;
}

const surfaceContextKey: InjectionKey<SurfaceContextValue> = Symbol("cui-surface-context");
const defaultSurfaceContext: SurfaceContextValue = {
  accent: computed(() => undefined),
  level: computed(() => 0),
};

export function provideSurfaceContext(
  level: MaybeRefOrGetter<number>,
  accent: MaybeRefOrGetter<UiAccent | undefined>,
): SurfaceContextValue {
  const value: SurfaceContextValue = {
    accent: computed(() => toValue(accent)),
    level: computed(() => toValue(level)),
  };

  provide(surfaceContextKey, value);
  return value;
}

export function useSurface(): SurfaceContextValue {
  return inject(surfaceContextKey, defaultSurfaceContext);
}
