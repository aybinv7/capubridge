import type { CatalogEntry } from "./playground.types";

export const catalogEntries: CatalogEntry[] = [
  {
    count: 22,
    description: "Surface and cut primitives",
    id: "surfaces",
    label: "Surfaces",
    path: "/components/surfaces",
  },
  {
    count: 32,
    description: "Action states and geometry",
    id: "button",
    label: "Button",
    path: "/components/button",
  },
  {
    count: 12,
    description: "Mutually exclusive segment buttons",
    id: "segmented",
    label: "Segmented",
    path: "/components/segmented",
  },
  {
    count: 8,
    description: "Surface-backed action bar",
    id: "toolbar",
    label: "Toolbar",
    path: "/components/toolbar",
  },
  {
    count: 8,
    description: "Self-managing pressed button group",
    id: "toggle-group",
    label: "Toggle group",
    path: "/components/toggle-group",
  },
  {
    count: 23,
    description: "Compact status language",
    id: "chip",
    label: "Chip",
    path: "/components/chip",
  },
  {
    count: 29,
    description: "Continuous numeric control",
    id: "slider",
    label: "Slider",
    path: "/components/slider",
  },
  {
    count: 24,
    description: "Choice control with native form participation",
    id: "checkbox",
    label: "Checkbox",
    path: "/components/checkbox",
  },
  {
    count: 18,
    description: "Keyboard-first option picker",
    id: "select",
    label: "Select",
    path: "/components/select",
  },
  {
    count: 6,
    description: "Portalled dialog with focus management",
    id: "dialog",
    label: "Dialog",
    path: "/components/dialog",
  },
  {
    count: 8,
    description: "Anchored floating panel",
    id: "popover",
    label: "Popover",
    path: "/components/popover",
  },
  {
    count: 3,
    description: "Hover/focus label",
    id: "tooltip",
    label: "Tooltip",
    path: "/components/tooltip",
  },
  {
    count: 18,
    description: "Loading and progress states",
    id: "spinner",
    label: "Spinner",
    path: "/components/spinner",
  },
  {
    count: 10,
    description: "Keyboard-navigable tablist",
    id: "tabs",
    label: "Tabs",
    path: "/components/tabs",
  },
  {
    count: 8,
    description: "Disclosure groups",
    id: "accordion",
    label: "Accordion",
    path: "/components/accordion",
  },
];

export const catalogComponentCount = 38;
export const catalogStateCount = catalogEntries.reduce((sum, entry) => sum + entry.count, 0);
