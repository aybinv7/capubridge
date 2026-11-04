import { inject, provide, type InjectionKey, type Ref } from 'vue';

export interface TabsContextValue {
  baseId: string;
  setValue: (value: string) => void;
  value: Readonly<Ref<string | undefined>>;
}

const tabsContextKey: InjectionKey<TabsContextValue> = Symbol('cladd-tabs');

export function useTabsContext(): TabsContextValue {
  const context = inject(tabsContextKey, null);

  if (!context) {
    throw new Error(
      'cladd-vue: `TabsList`, `Tab` and `TabPanel` must be rendered inside a `Tabs` root.',
    );
  }

  return context;
}

export function provideTabsContext(value: TabsContextValue): void {
  provide(tabsContextKey, value);
}

export function tabId(baseId: string, value: string): string {
  return `${baseId}-tab-${value}`;
}

export function tabPanelId(baseId: string, value: string): string {
  return `${baseId}-panel-${value}`;
}
