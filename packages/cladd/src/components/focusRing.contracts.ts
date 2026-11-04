export const focusRingGroups = [
  'link',
  'button',
  'input',
  'textarea',
  'checkbox',
  'switch',
  'radio',
  'slider',
] as const;

export type FocusRingGroup = (typeof focusRingGroups)[number];

export const focusRingGroupClasses: Record<FocusRingGroup, string> = {
  link: 'group-focus-visible/cladd-link:scale-100 group-focus-visible/cladd-link:opacity-100',
  button:
    'group-focus-visible/cladd-button:scale-100 group-focus-visible/cladd-button:opacity-100',
  input:
    'group-has-[input:focus]/cladd-input:scale-100 group-has-[input:focus]/cladd-input:opacity-100',
  textarea:
    'group-has-[[contenteditable]:focus]/cladd-textarea:scale-100 group-has-[[contenteditable]:focus]/cladd-textarea:opacity-100',
  checkbox:
    'group-has-[input:focus-visible]/cladd-checkbox:scale-100 group-has-[input:focus-visible]/cladd-checkbox:opacity-100',
  switch:
    'group-has-[input:focus-visible]/cladd-switch:scale-100 group-has-[input:focus-visible]/cladd-switch:opacity-100',
  radio:
    'group-has-[input:focus-visible]/cladd-radio:scale-100 group-has-[input:focus-visible]/cladd-radio:opacity-100',
  slider:
    'group-has-[input:focus-visible]/cladd-slider:scale-100 group-has-[input:focus-visible]/cladd-slider:opacity-100',
};
