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
    count: 38,
    description: "Action states and geometry",
    id: "buttons",
    label: "Buttons",
    path: "/components/buttons",
  },
  {
    count: 23,
    description: "Chips and shortcuts",
    id: "data-display",
    label: "Data display",
    path: "/components/data-display",
  },
  {
    count: 29,
    description: "Continuous numeric control",
    id: "forms",
    label: "Slider",
    path: "/components/forms",
  },
  {
    count: 18,
    description: "Keyboard-first option picker",
    id: "select",
    label: "Select",
    path: "/components/select",
  },
  {
    count: 17,
    description: "Dialogs and floating layers",
    id: "overlays",
    label: "Overlays",
    path: "/components/overlays",
  },
  {
    count: 18,
    description: "Loading and progress states",
    id: "feedback",
    label: "Feedback",
    path: "/components/feedback",
  },
];

export const catalogComponentCount = 18;
export const catalogStateCount = catalogEntries.reduce((sum, entry) => sum + entry.count, 0);
