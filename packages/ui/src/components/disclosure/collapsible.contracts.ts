import type { Component } from "vue";

export interface CollapsibleRootProps {
  /** Disable the disclosure — the trigger stops toggling and gets `data-disabled`. */
  disabled?: boolean;
  /** Initial open state (uncontrolled). Default `false`. Ignored when `open` is provided. */
  defaultOpen?: boolean;
  /** Controlled open state. When provided, internal state is bypassed. */
  open?: boolean;
}

export type CollapsibleRootDefaultProps = Partial<
  Omit<CollapsibleRootProps, "defaultOpen" | "open">
>;

export interface CollapsiblePanelProps {
  /** Polymorphic root element. Defaults to `'div'`. */
  as?: string | Component;
  /**
   * Keep the panel mounted (at `height: 0`) while collapsed instead of unmounting it. Default
   * `false`: the panel still animates closed, then unmounts once the animation finishes.
   */
  keepMounted?: boolean;
}

export type CollapsiblePanelDefaultProps = Partial<Omit<CollapsiblePanelProps, "as">>;

export interface CollapsibleIndicatorState {
  disabled: boolean;
  open: boolean;
}

export interface CollapsibleIndicatorProps {
  /** Polymorphic root element. Defaults to `'span'`. */
  as?: string | Component;
}

export type CollapsibleIndicatorDefaultProps = Partial<Omit<CollapsibleIndicatorProps, "as">>;
