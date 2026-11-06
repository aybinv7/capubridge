import type {
  Bounds,
  IndexedControl,
  IndexedElement,
  Observation,
} from "../../src/types/automation.types.ts";

/** Synthetic decision cases. No client data and no real personal data: every name below is invented. */

/** An expected answer: a choice, a yes/no belief, a target named by its label, or a box around a point. */
export interface CaseExpectations {
  operation?: string;
  targetLabel?: string;
  goalReached?: boolean;
  screenReady?: boolean;
  visualPresent?: boolean;
  visualBox?: { left: number; top: number; right: number; bottom: number };
}

export interface DecisionCase {
  id: string;
  goal: string;
  observation: Observation;
  historyOperations: string[];
  screen: { fixture: string; width: number; height: number } | null;
  expect: CaseExpectations;
}

const SIGNALS_IDLE = { pendingRequests: 0, recentErrors: [], lastDbWrite: null };

function element(
  index: number,
  text: string,
  bounds: Bounds,
  options: Partial<IndexedElement> = {},
): IndexedElement {
  return {
    index,
    cssSelector: `#e${index}`,
    role: "button",
    text,
    enabled: true,
    visible: true,
    bounds,
    isInput: false,
    inputType: null,
    clickable: true,
    ...options,
  };
}

function control(index: number, text: string, bounds: Bounds): IndexedControl {
  return {
    index,
    bounds,
    className: "android.widget.Button",
    text,
    contentDesc: "",
    clickable: true,
    enabled: true,
  };
}

function webScreen(elements: IndexedElement[], pendingRequests = 0): Observation {
  return {
    native: {
      controls: [],
      packageName: "com.example.demoorders",
      activity: "MainActivity",
      systemUi: { keyboardVisible: false, dialogPresent: false },
      webViewBounds: [0, 0, 1080, 2400],
    },
    webview: { elements },
    signals: { ...SIGNALS_IDLE, pendingRequests },
    visual: { screenshotRef: "" },
  };
}

function nativeScreen(controls: IndexedControl[], dialogPresent: boolean): Observation {
  return {
    native: {
      controls,
      packageName: "com.example.demoorders",
      activity: "PermissionActivity",
      systemUi: { keyboardVisible: false, dialogPresent },
    },
    webview: null,
    signals: SIGNALS_IDLE,
    visual: { screenshotRef: "" },
  };
}

const ALLOW_BOX = { left: 0.139, top: 0.489, right: 0.86, bottom: 0.539 };

/** Text cases every model runs: the screen structure Jev reads on web-view screens. */
export const TEXT_CASES: readonly DecisionCase[] = [
  {
    id: "login-submit",
    goal: "sign in to the demo account",
    observation: webScreen([
      element(0, "", [60, 400, 960, 120], { role: "textbox", isInput: true, inputType: "email" }),
      element(1, "", [60, 560, 960, 120], {
        role: "textbox",
        isInput: true,
        inputType: "password",
      }),
      element(2, "Sign in", [60, 740, 960, 130]),
      element(3, "Forgot password?", [60, 900, 960, 80], { role: "link" }),
    ]),
    historyOperations: ["type", "type"],
    screen: null,
    expect: { operation: "tap", targetLabel: "Sign in", goalReached: false },
  },
  {
    id: "orders-loading",
    goal: "open order 102",
    observation: webScreen(
      [element(0, "Loading orders", [300, 1100, 480, 80], { role: "status", clickable: false })],
      3,
    ),
    historyOperations: ["tap"],
    screen: null,
    expect: { operation: "wait", screenReady: false },
  },
  {
    id: "orders-pick",
    goal: "open order 102",
    observation: webScreen([
      element(0, "Order 101, 3 items", [40, 300, 1000, 200]),
      element(1, "Order 102, 1 item", [40, 520, 1000, 200]),
      element(2, "Order 103, 5 items", [40, 740, 1000, 200]),
      element(3, "Back", [20, 120, 140, 120]),
    ]),
    historyOperations: [],
    screen: null,
    expect: { operation: "tap", targetLabel: "Order 102", goalReached: false },
  },
  {
    id: "settings-reached",
    goal: "open the settings screen",
    observation: webScreen([
      element(0, "Settings", [40, 120, 600, 120], { role: "heading", clickable: false }),
      element(1, "Dark mode", [40, 320, 1000, 140], { role: "switch" }),
      element(2, "Notifications", [40, 480, 1000, 140], { role: "switch" }),
      element(3, "Back", [20, 120, 140, 120]),
    ]),
    historyOperations: ["tap"],
    screen: null,
    expect: { operation: "done", goalReached: true },
  },
  {
    id: "native-dialog-structure",
    goal: "allow notifications",
    observation: nativeScreen(
      [
        control(0, "Allow", [150, 1174, 778, 120]),
        control(1, "Don't allow", [150, 1320, 778, 120]),
      ],
      true,
    ),
    historyOperations: [],
    screen: null,
    expect: { operation: "tap", targetLabel: "Allow", goalReached: false },
  },
];

/** Visual cases: a native screen whose structure is invisible, so only the screenshot can answer. */
export const VISUAL_CASES: readonly DecisionCase[] = [
  {
    id: "dialog-by-box",
    goal: "allow notifications",
    observation: nativeScreen([], true),
    historyOperations: [],
    screen: { fixture: "permission-dialog-720x1280.png", width: 720, height: 1280 },
    expect: { operation: "tap", visualPresent: true, visualBox: ALLOW_BOX },
  },
  {
    id: "no-dialog-by-box",
    goal: "allow notifications",
    observation: nativeScreen([], false),
    historyOperations: [],
    screen: { fixture: "order-list-720x1280.png", width: 720, height: 1280 },
    expect: { visualPresent: false },
  },
];

/** Calibration images: one screen at two sizes, so the base and per-pixel costs separate. */
export const CALIBRATION_IMAGES = [
  { fixture: "permission-dialog-720x1280.png", width: 720, height: 1280 },
  { fixture: "permission-dialog-360x640.png", width: 360, height: 640 },
] as const;
