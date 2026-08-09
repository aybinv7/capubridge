import type { Component } from "vue";

import type { SegmentedProps } from "../actions/segmented.contracts.ts";

export type TabsListDefaultProps = Partial<Omit<SegmentedProps, "as">>;

export interface TabsProps {
  /** Initially selected tab value (uncontrolled). Ignored when `value` is provided. */
  defaultValue?: string;
  /** Controlled selected tab value. When provided, internal state is bypassed. */
  value?: string;
}

export type TabsDefaultProps = Partial<Omit<TabsProps, "defaultValue" | "value">>;

export interface TabProps {
  /** Polymorphic root element. Defaults to `'button'`. */
  as?: string | Component;
  /** Identifies this tab. Matched against the `Tabs` selected value. */
  value: string;
}

export type TabDefaultProps = Partial<Omit<TabProps, "as" | "value">>;

export interface TabPanelProps {
  /** Polymorphic root element. Defaults to `'div'`. */
  as?: string | Component;
  /** Keep the panel in the DOM (just `hidden`) while inactive instead of unmounting it. Default `false`. */
  keepMounted?: boolean;
  /** The tab `value` this panel belongs to. */
  value: string;
}

export type TabPanelDefaultProps = Partial<Omit<TabPanelProps, "as" | "value">>;
