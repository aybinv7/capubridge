import { readPersisted, writePersisted } from "@/lib/persisted";
import { drawerViewFor, isDrawerView, type DrawerView } from "@/types/drawer.types";

const DRAWER_KEY = "capubridge:drawer";
const LEGACY_DOCK_KEY = "capubridge:dock";

export const DRAWER_DEFAULT_HEIGHT = 320;
export const DRAWER_MIN_HEIGHT = 120;

/** What the drawer remembers between runs. Pop-outs are not remembered: windows do not survive. */
export interface PersistedDrawer {
  isOpen: boolean;
  view: DrawerView;
  heightPx: number;
  maximized: boolean;
}

const DEFAULTS: PersistedDrawer = {
  isOpen: false,
  view: "logs",
  heightPx: DRAWER_DEFAULT_HEIGHT,
  maximized: false,
};

function isPersistedDrawer(value: unknown): value is PersistedDrawer {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.isOpen === "boolean" &&
    isDrawerView(candidate.view as string) &&
    typeof candidate.heightPx === "number" &&
    typeof candidate.maximized === "boolean"
  );
}

/** The old dock's open state, tab and height, so the drawer opens where the dock was. */
function readLegacyDock(): PersistedDrawer | null {
  const legacy = readPersisted<Record<string, unknown> | null>(
    LEGACY_DOCK_KEY,
    null,
    (value) => typeof value === "object" && value !== null,
  );
  if (!legacy) return null;
  const tab = typeof legacy.activeTab === "string" ? legacy.activeTab : null;
  return {
    isOpen: legacy.isOpen === true,
    view: drawerViewFor(tab)?.view ?? "logs",
    heightPx: typeof legacy.heightPx === "number" ? legacy.heightPx : DRAWER_DEFAULT_HEIGHT,
    maximized: false,
  };
}

export function readDrawerState(): PersistedDrawer {
  const saved = readPersisted<PersistedDrawer | null>(DRAWER_KEY, null, isPersistedDrawer);
  return saved ?? readLegacyDock() ?? DEFAULTS;
}

export function writeDrawerState(state: PersistedDrawer): void {
  writePersisted(DRAWER_KEY, state);
}
