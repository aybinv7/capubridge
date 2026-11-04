import { computed, type ComputedRef } from 'vue';

import { useUiContext } from '../contexts/uiContext.ts';
import type { ComponentDefaults } from '../foundations/componentDefaults.ts';

/**
 * Resolves a component's effective props, upstream's precedence:
 *
 * > explicit prop → `CladdProvider`'s `defaults[componentName]` → the component's built-in default
 *
 * A prop passed explicitly as `undefined` still falls back to the default — important so wrapper
 * components forwarding `:prop="prop"` don't clobber app-wide defaults.
 *
 * Vue's `withDefaults` cannot express this on its own: it fills built-ins before anything can tell
 * "not passed" from "passed the default value". So components declare every prop with an explicit
 * `undefined` default (which also suppresses Vue's absent-boolean casting) and hand their built-ins
 * to this helper instead.
 */
export function useComponentDefaults<P extends object, B extends object>(
  componentName: keyof ComponentDefaults,
  props: P,
  builtins: B,
): ComputedRef<B & P> {
  const ui = useUiContext();

  return computed(() => {
    const merged: Record<string, unknown> = {
      ...builtins,
      ...(ui.defaults.value[componentName] as
        | Record<string, unknown>
        | undefined),
    };

    for (const key in props) {
      const value = (props as Record<string, unknown>)[key];
      if (value !== undefined) merged[key] = value;
    }

    return merged as B & P;
  });
}
