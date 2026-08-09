export interface AccordionRootProps {
  /** Disable the whole accordion — every item's trigger stops toggling. */
  disabled?: boolean;
  /** Initial open item(s) (uncontrolled). Ignored when `value` is provided. */
  defaultValue?: string | string[];
  /** Allow more than one item open at once. Selection becomes an array. Default `false`. */
  multiple?: boolean;
  /**
   * Controlled open item(s). A single value in single-open mode, an array when `multiple`. When
   * provided, internal state is bypassed.
   */
  value?: string | string[];
}

export type AccordionRootDefaultProps = Partial<Omit<AccordionRootProps, "defaultValue" | "value">>;

export interface AccordionItemProps {
  /** Disable just this item. Combined with the accordion's own `disabled`. */
  disabled?: boolean;
  /** Identifies this item — matched against the accordion's open value(s). */
  value: string;
}

export type AccordionItemDefaultProps = Partial<Omit<AccordionItemProps, "value">>;
