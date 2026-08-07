import type { UiAccent, UiTheme } from "@capubridge/ui";

export interface PlaygroundPreferences {
  accent: UiAccent;
  interactionsEnabled: boolean;
  theme: UiTheme;
}

export interface CatalogEntry {
  count: number;
  description: string;
  id: string;
  label: string;
  path: string;
}

export interface ComponentApiEntry {
  defaultValue?: string;
  description: string;
  name: string;
  type: string;
}
