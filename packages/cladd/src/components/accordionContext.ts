import { inject, provide, type ComputedRef, type InjectionKey } from 'vue';

export interface AccordionContextValue {
  baseId: string;
  disabled: boolean;
  isItemOpen: (value: string) => boolean;
  toggleItem: (value: string) => void;
}

const accordionContextKey: InjectionKey<ComputedRef<AccordionContextValue>> =
  Symbol('cladd-accordion');

export function useAccordionContext(): ComputedRef<AccordionContextValue> {
  const context = inject(accordionContextKey, null);

  if (!context) {
    throw new Error(
      'cladd-vue: `AccordionItem` must be rendered inside an `AccordionRoot`.',
    );
  }

  return context;
}

export function provideAccordionContext(
  value: ComputedRef<AccordionContextValue>,
): void {
  provide(accordionContextKey, value);
}
