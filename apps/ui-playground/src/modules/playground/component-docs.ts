import type { ComponentApiEntry } from "./playground.types";

export const sliderApi: readonly ComponentApiEntry[] = [
  { name: "v-model", type: "number", description: "Controlled numeric value." },
  {
    name: "default-value",
    type: "number",
    defaultValue: "0",
    description: "Initial uncontrolled value.",
  },
  { name: "min", type: "number", defaultValue: "0", description: "Lower inclusive bound." },
  { name: "max", type: "number", defaultValue: "100", description: "Upper inclusive bound." },
  {
    name: "step",
    type: "number",
    defaultValue: "1",
    description: "Keyboard and pointer increment.",
  },
  {
    name: "size",
    type: '"xs" | "sm" | "md"',
    defaultValue: '"sm"',
    description: "Thumb geometry scale.",
  },
  {
    name: "variant",
    type: '"thumb" | "track"',
    defaultValue: '"thumb"',
    description: "Hairline thumb or recessed track.",
  },
  { name: "accent", type: "UiAccent", description: "Inherited when omitted." },
  {
    name: "disabled",
    type: "boolean",
    defaultValue: "false",
    description: "Prevents interaction and dims the control.",
  },
  {
    name: "read-only",
    type: "boolean",
    defaultValue: "false",
    description: "Preserves appearance while preventing writes.",
  },
  {
    name: "scale",
    type: '"linear" | "log" | SliderScale',
    defaultValue: '"linear"',
    description: "Maps a user value to the track position.",
  },
  {
    name: "debounce",
    type: "number",
    defaultValue: "0",
    description: "Delays emitted changes in milliseconds.",
  },
  {
    name: "throttle",
    type: "number",
    defaultValue: "0",
    description: "Limits emitted changes in milliseconds.",
  },
  {
    name: "@change",
    type: "(value: number, event?: Event) => void",
    description: "Fires when the model value changes.",
  },
];

export function createSliderCode(options: {
  color: string;
  disabled: boolean;
  readOnly: boolean;
  size: string;
}): string {
  return `<Slider
  v-model="value"
  size="${options.size}"
  color="${options.color}"
  ${options.disabled ? "disabled" : ':disabled="false"'}
  ${options.readOnly ? "read-only" : ':read-only="false"'}
  style="width: 18rem"
/>`;
}
