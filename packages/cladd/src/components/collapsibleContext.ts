import { inject, provide, type ComputedRef, type InjectionKey } from 'vue';

export interface CollapsibleContextValue {
  disabled: boolean;
  open: boolean;
  panelId: string;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  triggerId: string;
}

const collapsibleContextKey: InjectionKey<
  ComputedRef<CollapsibleContextValue>
> = Symbol('cladd-collapsible');

export function useCollapsibleContext(): ComputedRef<CollapsibleContextValue> {
  const context = inject(collapsibleContextKey, null);

  if (!context) {
    throw new Error(
      'cladd-vue: `CollapsibleTrigger`, `CollapsiblePanel` and `CollapsibleIndicator` must be used inside a `CollapsibleRoot` or `AccordionItem`.',
    );
  }

  return context;
}

export function provideCollapsibleContext(
  value: ComputedRef<CollapsibleContextValue>,
): void {
  provide(collapsibleContextKey, value);
}
