import type { Component } from 'vue';

/** Layout direction of the label/control/description stack. */
export type FieldOrientation = 'horizontal' | 'vertical';

/** Density of the label/control/description stack. */
export type FieldDensity = 'comfortable' | 'compact';

export interface FieldProps {
  /** Polymorphic root element. Defaults to `'div'`. */
  as?: string | Component;
  /** Explicit control ID. Overrides the generated ID. */
  controlId?: string;
  /** Density of the stack. Default `'comfortable'`. */
  density?: FieldDensity;
  /** Disable the field and its descendant controls. Default `false`. */
  disabled?: boolean;
  /** Mark the field invalid and include error IDs in the description. Default `false`. */
  invalid?: boolean;
  /** Layout direction of the stack. Default `'vertical'`. */
  orientation?: FieldOrientation;
  /** Mark the field required. Default `false`. */
  required?: boolean;
}

export type FieldDefaultProps = Partial<Omit<FieldProps, 'as' | 'controlId'>>;

export interface FieldGroupProps {
  /** Polymorphic root element. Defaults to `'div'`. */
  as?: string | Component;
  /** Accessible group title. Exposed through `aria-labelledby` when set. */
  label?: string;
}

export type FieldGroupDefaultProps = Partial<Omit<FieldGroupProps, 'as'>>;

export interface FieldLabelProps {
  /** Polymorphic root element. Defaults to `'label'`. */
  as?: string | Component;
  /** Explicit control ID. Defaults to the enclosing field control ID. */
  controlId?: string;
}

export type FieldLabelDefaultProps = Partial<Omit<FieldLabelProps, 'as'>>;

export interface FieldDescriptionProps {
  /** Polymorphic root element. Defaults to `'p'`. */
  as?: string | Component;
  /** Explicit description ID. Overrides the generated ID. */
  descriptionId?: string;
}

export type FieldDescriptionDefaultProps = Partial<
  Omit<FieldDescriptionProps, 'as'>
>;

export interface FieldErrorProps {
  /** Polymorphic root element. Defaults to `'p'`. */
  as?: string | Component;
  /** Explicit error ID. Overrides the generated ID. */
  errorId?: string;
  /** Announce dynamically shown errors with `role="alert"`. Default `false`. */
  live?: boolean;
}

export type FieldErrorDefaultProps = Partial<Omit<FieldErrorProps, 'as'>>;

export interface FieldSetProps {
  /** Disable the fieldset and its nested controls. Default `false`. */
  disabled?: boolean;
  /** Accessible legend text. Rendered through the `legend` slot when set. */
  legend?: string;
}

export type FieldSetDefaultProps = Partial<FieldSetProps>;

export interface FieldLegendProps {
  /** Polymorphic root element. Defaults to `'legend'`. */
  as?: string | Component;
}

export type FieldLegendDefaultProps = Partial<Omit<FieldLegendProps, 'as'>>;
