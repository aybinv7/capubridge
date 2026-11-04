import { inject, provide, type ComputedRef, type InjectionKey } from 'vue';

export interface NavRailContextValue {
  labels: ComputedRef<boolean>;
}

const navRailContextKey: InjectionKey<NavRailContextValue> =
  Symbol('cladd-nav-rail');

export function provideNavRailContext(
  value: NavRailContextValue,
): NavRailContextValue {
  provide(navRailContextKey, value);
  return value;
}

export function useNavRailContext(): NavRailContextValue | null {
  return inject(navRailContextKey, null);
}
