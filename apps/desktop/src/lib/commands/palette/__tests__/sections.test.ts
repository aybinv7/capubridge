import { describe, expect, test, vi } from "vite-plus/test";
import type { Command } from "../../types";
import type { PaletteApp } from "../items";
import { queryScore, scoreItems } from "../rank";
import { buildPaletteSections, flattenItems, type PaletteBuildInput } from "../sections";

function command(id: string, title: string, extra: Partial<Command> = {}): Command {
  return { id, title, group: "View", run: vi.fn(), ...extra };
}

function app(packageName: string, label: string | null, serial = "S1"): PaletteApp {
  return { serial, packageName, apkPath: "/a.apk", iconPath: null, label, system: false };
}

const commands: Command[] = [
  command("nav.devices", "Go to Device", { group: "Navigate" }),
  command("route.devices-files", "Device › Files", { group: "Navigate" }),
  command("route.storage-sqlite", "Data › SQLite", {
    group: "Navigate",
    keywords: ["Data", "SQLite"],
  }),
  command("route.storage-opfs", "Data › OPFS", { group: "Navigate", keywords: ["Data", "OPFS"] }),
  command("route.network-requests", "Network › Requests", { group: "Navigate" }),
  command("data.sqlite.open-file", "Open a SQLite file…", { group: "Data", keywords: ["sqlite"] }),
  command("app.restart", "Restart Presalio", { group: "App" }),
  command("device.pixel", "Pixel 10 Pro", { group: "Devices", section: "switch" }),
  command("table.res_partner", "res_partner", {
    group: "Data",
    section: "tables",
    dormant: true,
    detail: "presalio · 4,182 rows",
  }),
  command("screen.refresh", "Read again", { group: "Data", screen: true }),
];

const apps = [app("com.sig.presalio", "Presalio Retail"), app("com.example.notes", "Notes")];

function build(
  mode: PaletteBuildInput["mode"],
  text: string,
  extra: Partial<PaletteBuildInput> = {},
) {
  return buildPaletteSections({
    mode,
    text,
    commands,
    recents: [],
    apps,
    recentApps: [],
    ...extra,
  });
}

function titles(
  mode: PaletteBuildInput["mode"],
  text: string,
  extra: Partial<PaletteBuildInput> = {},
): string[] {
  return flattenItems(build(mode, text, extra)).map((item) => item.title);
}

describe("fuzzy ranking", () => {
  test("every word of the query must match, in any order", () => {
    expect(queryScore("data sqlite", ["Data › SQLite"])).toBeGreaterThan(0);
    expect(queryScore("sqlite data", ["Data › SQLite"])).toBeGreaterThan(0);
    expect(queryScore("data nothing", ["Data › SQLite"])).toBe(0);
  });

  test("the title counts double", () => {
    expect(queryScore("files", ["Device › Files", ""])).toBeGreaterThan(
      queryScore("files", ["Other", "Device › Files"]),
    );
  });

  test("scoreItems drops misses and keeps order on ties", () => {
    const ranked = scoreItems(["b", "a", "c"], "", (value) => [value]).map((entry) => entry.item);
    expect(ranked).toEqual(["b", "a", "c"]);
    expect(scoreItems(["xyz"], "q", (value) => [value])).toEqual([]);
  });
});

describe("plain search", () => {
  test("'data sqlite' puts the SQLite destination first", () => {
    expect(titles("all", "data sqlite")[0]).toBe("Data › SQLite");
  });

  test("'sqlite' finds the destination, the file command and the table jump", () => {
    const found = titles("all", "sqlite");
    expect(found).toContain("Data › SQLite");
    expect(found).toContain("Open a SQLite file…");
    expect(found[0]).toBe("Data › SQLite");
  });

  test("'files' finds the Device destination", () => {
    expect(titles("all", "files")[0]).toBe("Device › Files");
  });

  test("dormant commands (tables) only appear once something is typed", () => {
    expect(titles("all", "")).not.toContain("res_partner");
    expect(titles("all", "res_par")).toContain("res_partner");
  });

  test("installed apps are offered from two characters", () => {
    expect(titles("all", "p")).not.toContain("Presalio Retail");
    expect(titles("all", "presalio")).toContain("Presalio Retail");
  });

  test("sections are ordered by their best match", () => {
    expect(build("all", "restart")[0]?.id).toBe("actions");
  });
});

describe("empty input", () => {
  test("lists recents first, then go-to, switchers and actions, without repeats", () => {
    const recent = commands.filter((entry) => entry.id === "app.restart");
    const sections = build("all", "", { recents: recent });
    expect(sections.map((entry) => entry.id)).toEqual(["recent", "go-to", "switch", "actions"]);
    const actions = sections.find((entry) => entry.id === "actions");
    expect(actions?.items.map((item) => item.title)).not.toContain("Restart Presalio");
  });
});

describe("prefix modes", () => {
  test("actions leaves out destinations, switchers and tables", () => {
    const listed = titles("actions", "");
    expect(listed).toContain("Restart Presalio");
    expect(listed).not.toContain("Data › SQLite");
    expect(listed).not.toContain("Pixel 10 Pro");
    expect(listed).not.toContain("res_partner");
  });

  test("devices lists the switchers only", () => {
    expect(titles("device", "")).toEqual(["Pixel 10 Pro"]);
  });

  test("tables lists every table even with nothing typed", () => {
    expect(titles("table", "")).toEqual(["res_partner"]);
    expect(titles("table", "part")).toEqual(["res_partner"]);
  });

  test("this screen lists the screen commands", () => {
    expect(titles("screen", "")).toEqual(["Read again"]);
  });
});

describe("open mode", () => {
  test("lists apps alphabetically with nothing typed", () => {
    expect(titles("open", "")).toEqual(["Notes", "Presalio Retail"]);
  });

  test("recently opened apps come first", () => {
    expect(titles("open", "", { recentApps: ["com.sig.presalio"] })).toEqual([
      "Presalio Retail",
      "Notes",
    ]);
  });

  test("matches the label and the package", () => {
    expect(titles("open", "retail")).toEqual(["Presalio Retail"]);
    expect(titles("open", "example")).toEqual(["Notes"]);
  });

  test("an app without a label is named by its package", () => {
    expect(titles("open", "", { apps: [app("com.bare.app", null)] })).toEqual(["com.bare.app"]);
  });
});
