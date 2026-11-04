import type { Component } from 'vue';

export interface NavRailProps {
  /** Polymorphic root element. Defaults to `'nav'`. */
  as?: string | Component;
  /** Show a text label under every item icon. Default `true`. */
  labels?: boolean;
}

export type NavRailDefaultProps = Partial<Omit<NavRailProps, 'as'>>;

export type NavRailItemCurrent = 'page' | 'location' | 'step' | 'true';

export interface NavRailItemProps {
  /** Polymorphic root element, such as a router link component. Defaults to `'a'`. */
  as?: string | Component;
  /** Marks the item as the current destination: raised two surface levels with a bevel. Default `false`. */
  active?: boolean;
  /** `aria-current` token announced while the item is active. Default `'page'`. */
  current?: NavRailItemCurrent;
  /** Dim the item and remove it from interaction. Default `false`. */
  disabled?: boolean;
  /** Keep the label as the accessible name but do not draw it. Default `false`. */
  hideLabel?: boolean;
  /** Item text, drawn under the icon and used as the accessible name. */
  label: string;
}

export type NavRailItemDefaultProps = Partial<
  Omit<NavRailItemProps, 'active' | 'as' | 'label'>
>;
