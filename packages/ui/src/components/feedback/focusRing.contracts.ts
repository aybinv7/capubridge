export const focusRingGroups = [
  "link",
  "button",
  "input",
  "textarea",
  "checkbox",
  "switch",
  "radio",
  "slider",
] as const;

export type FocusRingGroup = (typeof focusRingGroups)[number];

export const focusRingGroupClasses: Record<FocusRingGroup, string> = {
  link: "group-focus-visible/cui-link:scale-100 group-focus-visible/cui-link:opacity-100",
  button: "group-focus-visible/cui-button:scale-100 group-focus-visible/cui-button:opacity-100",
  input:
    "group-has-[input:focus]/cui-input:scale-100 group-has-[input:focus]/cui-input:opacity-100",
  textarea:
    "group-has-[[contenteditable]:focus]/cui-textarea:scale-100 group-has-[[contenteditable]:focus]/cui-textarea:opacity-100",
  checkbox:
    "group-has-[input:focus-visible]/cui-checkbox:scale-100 group-has-[input:focus-visible]/cui-checkbox:opacity-100",
  switch:
    "group-has-[input:focus-visible]/cui-switch:scale-100 group-has-[input:focus-visible]/cui-switch:opacity-100",
  radio:
    "group-has-[input:focus-visible]/cui-radio:scale-100 group-has-[input:focus-visible]/cui-radio:opacity-100",
  slider:
    "group-has-[input:focus-visible]/cui-slider:scale-100 group-has-[input:focus-visible]/cui-slider:opacity-100",
};
