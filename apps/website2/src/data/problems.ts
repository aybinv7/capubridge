export interface Problem {
  tool: string;
  title: string;
  description: string;
  cost: string;
  accent: string;
  /** Shown when the row is hovered. A video wins over the still if both are set. */
  capture: string;
  video?: string;
  answer: string;
}

export const problems: Problem[] = [
  {
    tool: "adb shell",
    title: "Devices live in your terminal",
    description:
      "adb devices, adb forward, adb shell. Every piece of state you care about has to be retyped, and nothing you learn stays on screen.",
    cost: "No visual context",
    accent: "#e8765a",
    capture: "inspector",
    answer: "Every device listed, with its own session",
  },
  {
    tool: "chrome://inspect",
    title: "The storage panel stops at read-only",
    description:
      "No search, no filters, no export, no editing. OPFS and SQLite-WASM are not listed at all, so an offline-first app hides most of its state from you.",
    cost: "Half the data is invisible",
    accent: "#8f86ff",
    capture: "storage",
    answer: "Six engines, searchable and editable",
  },
  {
    tool: "DevTools window",
    title: "The phone leaves the frame",
    description:
      "Inspect in a floating window and the device that produced the bug is behind it. Framework devtools do not survive the trip over remote debugging either.",
    cost: "Constant context switch",
    accent: "#5ad39a",
    capture: "vueDevtools",
    answer: "DOM, styles and the live phone side by side",
  },
  {
    tool: "Android Studio",
    title: "Native logs live somewhere else",
    description:
      "An entire IDE opened to read a log stream, in a window where a JS exception and the native line that caused it never line up.",
    cost: "Two clocks, no correlation",
    accent: "#f0c36b",
    capture: "replay",
    answer: "Console, exceptions and logcat in one stream",
  },
  {
    tool: "Your screen only",
    title: "Nothing survives the session",
    description:
      "Terminal scrollback is local. When QA finds it and you have to reproduce it, the whole investigation starts again from zero.",
    cost: "Nothing to hand off",
    accent: "#71cbff",
    capture: "performance",
    answer: "A recorded session you can send",
  },
];
