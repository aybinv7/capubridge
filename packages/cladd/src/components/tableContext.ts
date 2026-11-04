import { inject, provide, type ComputedRef, type InjectionKey } from 'vue';

export interface TableContextValue {
  dense: ComputedRef<boolean>;
  hoverable: ComputedRef<boolean>;
}

const tableContextKey: InjectionKey<TableContextValue> = Symbol('cladd-table');

export function provideTableContext(
  value: TableContextValue,
): TableContextValue {
  provide(tableContextKey, value);
  return value;
}

export function useTableContext(): TableContextValue | null {
  return inject(tableContextKey, null);
}
