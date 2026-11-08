import { computed, ref, watch } from "vue";
import { useCommandsStore } from "@/stores/commands.store";
import { useUIStore } from "@/stores/ui.store";
import type { PaletteItem, PaletteSectionView } from "@/lib/commands/palette/items";
import {
  PALETTE_MODES,
  applyInput,
  leaveMode,
  parsePaletteInput,
  type PaletteMode,
  type PaletteState,
} from "@/lib/commands/palette/modes";
import { flattenRows, itemKeys, stepKey } from "@/lib/commands/palette/rows";
import { buildPaletteSections } from "@/lib/commands/palette/sections";
import { usePaletteApps, type PaletteAppsState } from "./usePaletteApps";

const PAGE_STEP = 8;

function appsNotice(
  state: PaletteAppsState,
  error: string | null,
  chooseDevice: () => void,
): PaletteSectionView[] {
  const notice = (item: Omit<Extract<PaletteItem, { kind: "notice" }>, "kind" | "section">) => [
    {
      id: "apps" as const,
      label: "Apps",
      items: [{ kind: "notice" as const, section: "apps" as const, ...item }],
    },
  ];
  switch (state) {
    case "no-device":
      return notice({
        key: "notice:no-device",
        title: "No device selected",
        subtitle: "Choose a device to open its apps",
        action: chooseDevice,
      });
    case "offline":
      return notice({
        key: "notice:offline",
        title: "This device is not reachable",
        subtitle: "Choose another device or reconnect it",
        action: chooseDevice,
      });
    case "loading":
      return notice({
        key: "notice:loading",
        title: "Reading the apps on the phone…",
        subtitle: null,
        action: null,
      });
    case "error":
      return notice({
        key: "notice:error",
        title: "Could not read the apps",
        subtitle: error,
        action: null,
      });
    case "ready":
      return [];
  }
}

/**
 * The command palette's state: the mode and text typed, the sections they produce, which row is
 * highlighted and what choosing a row does. Selecting is separate from rendering, so the list
 * component only draws rows.
 */
export function usePalette(initialQuery = "") {
  const commands = useCommandsStore();
  const ui = useUIStore();

  const state = ref<PaletteState>(parsePaletteInput(initialQuery));
  const mode = computed(() => state.value.mode);
  const text = computed(() => state.value.text);
  const modeMeta = computed(() => PALETTE_MODES[state.value.mode]);

  const apps = usePaletteApps(computed(() => state.value.mode === "open"));

  const sections = computed<PaletteSectionView[]>(() => {
    const built = buildPaletteSections({
      mode: state.value.mode,
      text: state.value.text,
      commands: commands.available,
      recents: commands.recent,
      apps: apps.apps.value,
      recentApps: commands.recentApps,
    });
    if (state.value.mode !== "open") return built;
    const notice = appsNotice(apps.state.value, apps.error.value, () => {
      commands.closePalette();
      ui.openDeviceManager();
    });
    if (notice.length > 0) return notice;
    if (built.length > 0 || !state.value.text.trim()) return built;
    return buildPaletteSections({
      mode: "all",
      text: `open ${state.value.text}`,
      commands: commands.available,
      recents: [],
      apps: [],
      recentApps: [],
    });
  });

  const rows = computed(() => flattenRows(sections.value));
  const keys = computed(() => itemKeys(rows.value));
  const itemByKey = computed(() => {
    const map = new Map<string, PaletteItem>();
    for (const row of rows.value) if (row.type === "item") map.set(row.key, row.item);
    return map;
  });

  const highlighted = ref<string | null>(null);
  const navigated = ref(0);

  watch(
    keys,
    (next) => {
      if (highlighted.value === null || !next.includes(highlighted.value)) {
        highlighted.value = next[0] ?? null;
      }
    },
    { immediate: true },
  );

  watch([mode, text], () => {
    highlighted.value = keys.value[0] ?? null;
    navigated.value += 1;
  });

  function input(raw: string) {
    state.value = applyInput(state.value, raw);
  }

  function enterMode(next: PaletteMode) {
    state.value = { mode: next, text: "" };
  }

  function back(): boolean {
    const next = leaveMode(state.value);
    if (next === state.value) return false;
    state.value = next;
    return true;
  }

  function move(delta: number) {
    highlighted.value = stepKey(keys.value, highlighted.value, delta);
    navigated.value += 1;
  }

  function hover(key: string) {
    if (highlighted.value !== key) highlighted.value = key;
  }

  function choose(item: PaletteItem | undefined) {
    if (!item) return;
    if (item.kind === "notice") {
      item.action?.();
      return;
    }
    commands.closePalette();
    if (item.kind === "command") {
      void commands.run(item.command);
      return;
    }
    void apps.open(item.app);
  }

  function chooseHighlighted() {
    choose(highlighted.value ? itemByKey.value.get(highlighted.value) : undefined);
  }

  function chooseKey(key: string) {
    choose(itemByKey.value.get(key));
  }

  return {
    mode,
    text,
    modeMeta,
    rows,
    highlighted,
    navigated,
    input,
    enterMode,
    back,
    move,
    pageStep: PAGE_STEP,
    hover,
    chooseHighlighted,
    chooseKey,
  };
}
