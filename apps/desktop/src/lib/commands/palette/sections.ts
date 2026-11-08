import type { Command } from "../types";
import {
  SECTION_LABELS,
  SECTION_ORDER,
  appItem,
  appTitle,
  commandItem,
  sectionOf,
  type PaletteApp,
  type PaletteItem,
  type PaletteSectionId,
  type PaletteSectionView,
} from "./items";
import type { PaletteMode } from "./modes";
import { scoreItems } from "./rank";

export interface PaletteBuildInput {
  mode: PaletteMode;
  text: string;
  /** Commands whose `when` allows them now. */
  commands: readonly Command[];
  /** The recently run ones, most recent first. */
  recents: readonly Command[];
  apps: readonly PaletteApp[];
  /** Package names, most recently opened first. */
  recentApps: readonly string[];
}

/** Apps and tables listed in a plain search, so they do not crowd out screens and actions. */
export const SEARCH_APP_LIMIT = 5;
export const SEARCH_TABLE_LIMIT = 8;
/** A plain search starts finding apps from this many characters. */
export const SEARCH_APP_MIN_CHARS = 2;

function commandFields(command: Command): string[] {
  return [command.title, command.detail ?? "", ...(command.keywords ?? []), command.group];
}

function appFields(app: PaletteApp): string[] {
  return [appTitle(app), app.packageName];
}

function section(id: PaletteSectionId, items: PaletteItem[]): PaletteSectionView[] {
  return items.length > 0 ? [{ id, label: SECTION_LABELS[id], items }] : [];
}

function rankedCommands(
  commands: readonly Command[],
  text: string,
  keep: (command: Command) => boolean,
  includeDormant = false,
) {
  const candidates = commands.filter(
    (command) => keep(command) && (includeDormant || !command.dormant || text.trim() !== ""),
  );
  return scoreItems(candidates, text, commandFields);
}

function emptySearchSections(input: PaletteBuildInput): PaletteSectionView[] {
  const recent = input.recents.filter((command) => !command.dormant);
  const shown = new Set(recent.map((command) => command.id));
  const bySection = new Map<PaletteSectionId, PaletteItem[]>();
  for (const { item: command } of rankedCommands(input.commands, "", () => true)) {
    if (shown.has(command.id)) continue;
    const id = sectionOf(command);
    const items = bySection.get(id) ?? [];
    items.push(commandItem(command, id));
    bySection.set(id, items);
  }
  return [
    ...section(
      "recent",
      recent.map((command) => commandItem(command, "recent")),
    ),
    ...SECTION_ORDER.filter((id) => id !== "recent").flatMap((id) =>
      section(id, bySection.get(id) ?? []),
    ),
  ];
}

function searchSections(input: PaletteBuildInput): PaletteSectionView[] {
  const text = input.text;
  const groups = new Map<PaletteSectionId, { items: PaletteItem[]; best: number }>();
  const add = (id: PaletteSectionId, item: PaletteItem, score: number) => {
    const group = groups.get(id) ?? { items: [], best: 0 };
    group.items.push(item);
    group.best = Math.max(group.best, score);
    groups.set(id, group);
  };

  for (const { item: command, score } of rankedCommands(input.commands, text, () => true)) {
    const id = sectionOf(command);
    add(id, commandItem(command, id), score);
  }
  if (text.trim().length >= SEARCH_APP_MIN_CHARS) {
    for (const { item: app, score } of scoreItems(input.apps, text, appFields)) {
      add("apps", appItem(app), score);
    }
  }

  const limits: Partial<Record<PaletteSectionId, number>> = {
    apps: SEARCH_APP_LIMIT,
    tables: SEARCH_TABLE_LIMIT,
  };
  return [...groups.entries()]
    .sort(
      ([a, left], [b, right]) =>
        right.best - left.best || SECTION_ORDER.indexOf(a) - SECTION_ORDER.indexOf(b),
    )
    .map(([id, group]) => ({
      id,
      label: SECTION_LABELS[id],
      items: group.items.slice(0, limits[id] ?? group.items.length),
    }));
}

function appSections(input: PaletteBuildInput): PaletteSectionView[] {
  if (input.text.trim()) {
    return section(
      "apps",
      scoreItems(input.apps, input.text, appFields).map(({ item }) => appItem(item)),
    );
  }
  const rank = new Map(input.recentApps.map((name, index) => [name, index]));
  const sorted = [...input.apps].sort((a, b) => {
    const left = rank.get(a.packageName) ?? Number.POSITIVE_INFINITY;
    const right = rank.get(b.packageName) ?? Number.POSITIVE_INFINITY;
    if (left !== right) return left - right;
    return appTitle(a).localeCompare(appTitle(b), undefined, { sensitivity: "base" });
  });
  return section("apps", sorted.map(appItem));
}

function commandSections(
  input: PaletteBuildInput,
  keep: (command: Command) => boolean,
  includeDormant = false,
): PaletteSectionView[] {
  const items = rankedCommands(input.commands, input.text, keep, includeDormant).map(
    ({ item: command }) => commandItem(command, sectionOf(command)),
  );
  const bySection = new Map<PaletteSectionId, PaletteItem[]>();
  for (const item of items) {
    const list = bySection.get(item.section) ?? [];
    list.push(item);
    bySection.set(item.section, list);
  }
  return SECTION_ORDER.flatMap((id) => section(id, bySection.get(id) ?? []));
}

/**
 * What the palette lists for what was typed: sections of items, best first. Empty input in the
 * plain mode shows recents, then every screen, switcher and action; a search ranks across all of
 * them (and installed apps); each prefix mode narrows to its own kind.
 */
export function buildPaletteSections(input: PaletteBuildInput): PaletteSectionView[] {
  switch (input.mode) {
    case "all":
      return input.text.trim() ? searchSections(input) : emptySearchSections(input);
    case "open":
      return appSections(input);
    case "actions":
      return commandSections(input, (command) => sectionOf(command) === "actions");
    case "device":
      return commandSections(input, (command) => sectionOf(command) === "switch");
    case "table":
      return commandSections(input, (command) => sectionOf(command) === "tables", true);
    case "screen":
      return commandSections(input, (command) => command.screen === true);
  }
}

/** Items in the order the list shows and the arrow keys move through them. */
export function flattenItems(sections: readonly PaletteSectionView[]): PaletteItem[] {
  return sections.flatMap((entry) => entry.items);
}
