import {
  computed,
  inject,
  provide,
  toValue,
  type InjectionKey,
  type MaybeRefOrGetter,
  type Ref,
} from 'vue';

import type { Color } from '../types.ts';

/**
 * Tracks the surface depth of the current subtree. Each `Surface` publishes its own level (or
 * `currentLevel - 1` for `variant="transparent"`) so nested surfaces can resolve relative levels
 * (e.g. `"+1"`/`"-1"`) and pick appropriate background tones.
 */
export interface SurfaceContextValue {
  /**
   * Accent color of the nearest enclosing colored surface, mirroring the `cladd-color-{name}` CSS
   * cascade so descendants can read the region color in JS. `undefined` when no surface up the
   * tree set a color.
   */
  color: Readonly<Ref<Color | undefined>>;
  /** Current surface depth (1–5). `0` outside any `Surface`. */
  level: Readonly<Ref<number>>;
}

const surfaceContextKey: InjectionKey<SurfaceContextValue> = Symbol(
  'cladd-surface-context',
);
const defaultSurfaceContext: SurfaceContextValue = {
  color: computed(() => undefined),
  level: computed(() => 0),
};

export function provideSurfaceContext(
  level: MaybeRefOrGetter<number>,
  color: MaybeRefOrGetter<Color | undefined>,
): SurfaceContextValue {
  const value: SurfaceContextValue = {
    color: computed(() => toValue(color)),
    level: computed(() => toValue(level)),
  };

  provide(surfaceContextKey, value);
  return value;
}

/**
 * Resets the region color to `undefined` while preserving the surface level, for use at portal
 * boundaries. Vue's provide/inject crosses teleports but the `cladd-color-{name}` CSS cascade does
 * not — without this, a teleported overlay would inherit a colored ancestor's region color through
 * context while its DOM renders neutral.
 */
export function provideSurfaceColorReset(): SurfaceContextValue {
  const parent = useSurface();
  return provideSurfaceContext(
    () => parent.level.value,
    () => undefined,
  );
}

export function useSurface(): SurfaceContextValue {
  return inject(surfaceContextKey, defaultSurfaceContext);
}
