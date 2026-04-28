export interface Screenshot {
  src: string;
  title: string;
  caption: string;
  mode: "hero" | "wide" | "tall";
}

export interface HeroMode {
  key: string;
  label: string;
  title: string;
  summary: string;
  screenshot: Screenshot;
  metrics: { value: string; label: string }[];
  overlays: {
    label: string;
    value: string;
    tone: "accent" | "info" | "success";
    position: string;
  }[];
}

export interface BentoCard {
  key: string;
  label: string;
  title: string;
  body: string;
  screenshot: Screenshot;
  metrics: string[];
  accent: string;
}

export const navItems = [
  { label: "Surfaces", href: "#surfaces" },
  { label: "Workflow", href: "#workflow" },
];

export const screenshots: Screenshot[] = [
  {
    src: "/screenshots/Screenshot%202026-04-28%20203814.png",
    title: "App inspector and live mirror",
    caption:
      "Package metadata, permissions, target state, and the running device view stay in the same inspection context.",
    mode: "hero",
  },
  {
    src: "/screenshots/Screenshot%202026-04-28%20204022.png",
    title: "Storage graph workspace",
    caption:
      "IndexedDB, local storage, cache, OPFS, notes, and inferred links become a map instead of scattered browser tabs.",
    mode: "wide",
  },
  {
    src: "/screenshots/Screenshot%202026-04-28%20204307.png",
    title: "Element inspection with device proof",
    caption:
      "DOM inspection, properties, events, and the phone surface stay together for mobile-only debugging.",
    mode: "wide",
  },
  {
    src: "/screenshots/Screenshot%202026-04-28%20203716.png",
    title: "Device readiness",
    caption:
      "Display, CPU, memory, storage, network, Android version, and root state are visible before the investigation starts.",
    mode: "tall",
  },
  {
    src: "/screenshots/Screenshot%202026-04-28%20203926.png",
    title: "Runtime telemetry",
    caption:
      "Performance, logs, and device state become shared release evidence instead of local terminal output.",
    mode: "wide",
  },
  {
    src: "/screenshots/Screenshot%202026-04-28%20204458.png",
    title: "Reviewable session context",
    caption:
      "A debugging session can move from tester to developer without losing the device, target, or artifact trail.",
    mode: "wide",
  },
];

export const heroModes: HeroMode[] = [
  {
    key: "inspect",
    label: "App inspector",
    title: "One physical device. One selected package. One live runtime.",
    summary: "Phone mirror, package scope, and WebView target stay pinned while the issue is live.",
    screenshot: screenshots[0],
    metrics: [
      { value: "ADB", label: "package actions" },
      { value: "Mirror", label: "live device proof" },
      { value: "Target", label: "selected WebView" },
    ],
    overlays: [
      {
        label: "Package",
        value: "selected app scope",
        tone: "accent",
        position: "left-3 top-4 md:left-6 md:top-6",
      },
      {
        label: "Target",
        value: "runtime stays explicit",
        tone: "info",
        position: "right-3 top-8 md:right-8 md:top-12",
      },
      {
        label: "Mirror",
        value: "visual proof persists",
        tone: "success",
        position: "bottom-5 left-4 md:bottom-8 md:left-8",
      },
    ],
  },
  {
    key: "storage",
    label: "Storage graph",
    title: "Track real state across IndexedDB, OPFS, Cache API, SQLite, and package files.",
    summary: "Walk IndexedDB, Cache API, OPFS, SQLite, and package files as one state graph.",
    screenshot: screenshots[1],
    metrics: [
      { value: "Graph", label: "relationships" },
      { value: "Origins", label: "state stays navigable" },
      { value: "Files", label: "package context" },
    ],
    overlays: [
      {
        label: "Origins",
        value: "state stays navigable",
        tone: "accent",
        position: "left-3 top-4 md:left-6 md:top-7",
      },
      {
        label: "Graph",
        value: "notes + inferred links",
        tone: "info",
        position: "right-3 top-8 md:right-8 md:top-12",
      },
      {
        label: "Evidence",
        value: "no tab sprawl",
        tone: "success",
        position: "bottom-5 right-4 md:bottom-8 md:right-9",
      },
    ],
  },
  {
    key: "elements",
    label: "Element evidence",
    title: "Inspect the live UI while the mobile surface stays visible.",
    summary: "Keep DOM and phone state in the same frame while inspecting the live UI.",
    screenshot: screenshots[2],
    metrics: [
      { value: "DOM", label: "structure + props" },
      { value: "Phone", label: "same visual state" },
      { value: "Proof", label: "team-readable context" },
    ],
    overlays: [
      {
        label: "Inspector",
        value: "DOM + properties",
        tone: "accent",
        position: "left-3 top-4 md:left-6 md:top-7",
      },
      {
        label: "Phone",
        value: "mobile view persists",
        tone: "success",
        position: "right-3 top-8 md:right-8 md:top-12",
      },
      {
        label: "UI bug",
        value: "mobile-only clarity",
        tone: "info",
        position: "bottom-5 left-4 md:bottom-8 md:left-9",
      },
    ],
  },
];

export const bentoCards: BentoCard[] = [
  {
    key: "inspect",
    label: "App inspector",
    title: "Selected device and package stay anchored",
    body: "Open exact runtime surface without losing the phone, the package, or the current target.",
    screenshot: screenshots[0],
    metrics: ["Package scope", "Permissions", "Mirror"],
    accent: "#e8765a",
  },
  {
    key: "storage",
    label: "Storage graph",
    title: "State becomes a map instead of a hunt",
    body: "Move through IndexedDB, Cache API, OPFS, SQLite, and package files without breaking context.",
    screenshot: screenshots[1],
    metrics: ["Graph", "Origins", "Notes"],
    accent: "#71cbff",
  },
  {
    key: "elements",
    label: "Element evidence",
    title: "The phone stays next to the DOM",
    body: "Inspect the interface while the exact mobile state that triggered the bug remains visible.",
    screenshot: screenshots[2],
    metrics: ["DOM", "Props", "Live screen"],
    accent: "#8f86ff",
  },
  {
    key: "readiness",
    label: "Device readiness",
    title: "Know the target before you touch it",
    body: "Display, CPU, memory, network, Android version, root, and package posture are visible up front.",
    screenshot: screenshots[3],
    metrics: ["CPU", "Memory", "Android"],
    accent: "#f0c36b",
  },
  {
    key: "telemetry",
    label: "Runtime telemetry",
    title: "Signals stay attached to the session",
    body: "Performance and runtime data read like shared evidence instead of local terminal output.",
    screenshot: screenshots[4],
    metrics: ["Perf", "Signals", "Release"],
    accent: "#5ad39a",
  },
  {
    key: "review",
    label: "Incident review",
    title: "A bug can move across teams without losing shape",
    body: "QA, support, platform, and engineering work from the same device memory and evidence path.",
    screenshot: screenshots[5],
    metrics: ["Handoff", "Context", "Teams"],
    accent: "#f2efe9",
  },
];

export const systemChips = [
  "Developers",
  "QA labs",
  "Platform teams",
  "Support escalation",
  "Security review",
  "Release sign-off",
];

export const workflowChips = ["Attach", "Inspect", "Trace state", "Capture proof", "Hand off"];
