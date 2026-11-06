import type { Component } from "vue";
import type { Color } from "@capubridge/cladd";

/** What a stream's state looks like: a dot, one word, and a quiet detail. */
export interface StreamStatusView {
  word: string;
  detail: string | null;
  color: Color | undefined;
  variant: "solid" | "hollow";
  pulse: boolean;
}

/** One thing an opened row offers: filter, copy, open the request, show the moment. */
export interface RowAction {
  id: string;
  label: string;
  icon: Component;
}

/** One level the query can start from: its glyph, name, and how many kept items have it. */
export interface LevelOption {
  value: string;
  glyph: string;
  name: string;
  count: number;
  /** Text tone of the glyph: errors red, warnings amber, the rest neutral. */
  tone: "error" | "warning" | "plain" | "muted";
}
