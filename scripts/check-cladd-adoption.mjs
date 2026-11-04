import { readdir, readFile, writeFile } from "node:fs/promises";
import { extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Ratchet for decision D3 (Cladd is the visual foundation). shadcn-vue styled
 * components that have a Cladd equivalent may not gain new imports, and every
 * migration must tighten the baseline, so the count only ever goes down.
 *
 * Usage: node scripts/check-cladd-adoption.mjs [--update | --seed]
 * `--update` only tightens (it refuses while anything grew); `--seed` only runs without a baseline.
 */

const root = fileURLToPath(new URL("../", import.meta.url));
const sourceRoot = resolve(root, "apps/desktop/src");
const baselinePath = resolve(root, "scripts/cladd-adoption-baseline.json");
const sourceExtensions = new Set([".ts", ".vue"]);

/** shadcn-vue component → the Cladd component that replaces it. */
export const retiring = {
  badge: "Chip",
  button: "Button",
  "button-group": "Toolbar / Segmented",
  card: "Surface",
  checkbox: "Checkbox",
  collapsible: "Collapsible*",
  "confirm-dialog": "Dialog",
  dialog: "Dialog",
  input: "Input",
  "input-group": "InputGroup",
  label: "FieldLabel",
  popover: "Popover",
  select: "Select",
  spinner: "Spinner",
  switch: "Switch",
  tabs: "Tabs",
  textarea: "Textarea",
  tooltip: "Tooltip",
};

const importPattern = /from\s+["']@\/components\/ui\/([a-z-]+)(?:\/[^"']*)?["']/g;

function normalizedPath(path) {
  return path.replaceAll("\\", "/");
}

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        return normalizedPath(path).endsWith("/src/components/ui") ? [] : collectFiles(path);
      }
      return sourceExtensions.has(extname(entry.name)) ? [path] : [];
    }),
  );
  return files.flat();
}

/** Counts imports of retiring components in one source file. */
export function countRetiringImports(source) {
  const counts = {};
  for (const match of source.matchAll(importPattern)) {
    const component = match[1];
    if (!(component in retiring)) continue;
    counts[component] = (counts[component] ?? 0) + 1;
  }
  return counts;
}

/** `{ file: { component: count } }` for the whole app, files with no usage omitted. */
export async function measureUsage() {
  const usage = {};
  for (const file of await collectFiles(sourceRoot)) {
    const counts = countRetiringImports(await readFile(file, "utf8"));
    if (Object.keys(counts).length > 0) usage[normalizedPath(relative(root, file))] = counts;
  }
  return usage;
}

/**
 * Compares usage with the baseline. Growth is a violation; shrinkage is
 * reported so the baseline is tightened in the same change.
 */
export function compareWithBaseline(usage, baseline) {
  const grown = [];
  const shrunk = [];
  const files = new Set([...Object.keys(usage), ...Object.keys(baseline)]);
  for (const file of [...files].sort()) {
    const now = usage[file] ?? {};
    const allowed = baseline[file] ?? {};
    const components = new Set([...Object.keys(now), ...Object.keys(allowed)]);
    for (const component of [...components].sort()) {
      const current = now[component] ?? 0;
      const limit = allowed[component] ?? 0;
      if (current > limit) grown.push({ file, component, current, limit });
      else if (current < limit) shrunk.push({ file, component, current, limit });
    }
  }
  return { grown, shrunk };
}

function sortedUsage(usage) {
  return Object.fromEntries(
    Object.keys(usage)
      .sort()
      .map((file) => [
        file,
        Object.fromEntries(Object.entries(usage[file]).sort(([a], [b]) => a.localeCompare(b))),
      ]),
  );
}

/** The recorded baseline, or `null` when none has been seeded yet. */
async function readBaseline() {
  try {
    return JSON.parse(await readFile(baselinePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function writeBaseline(usage) {
  await writeFile(baselinePath, `${JSON.stringify(sortedUsage(usage), null, 2)}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const usage = await measureUsage();
  const recorded = await readBaseline();
  if (recorded === null && process.argv.includes("--seed")) {
    await writeBaseline(usage);
    console.log("Cladd adoption baseline seeded");
    process.exit(0);
  }
  if (recorded === null) {
    console.error(
      "No Cladd adoption baseline: run node scripts/check-cladd-adoption.mjs --seed once",
    );
    process.exit(1);
  }
  const { grown, shrunk } = compareWithBaseline(usage, recorded);

  if (grown.length > 0) {
    for (const { file, component, current, limit } of grown) {
      console.error(
        `${file}: ${current} import(s) of @/components/ui/${component} (allowed ${limit}) — use Cladd ${retiring[component]} from @capubridge/cladd`,
      );
    }
    process.exitCode = 1;
  } else if (process.argv.includes("--update")) {
    await writeBaseline(usage);
    console.log("Cladd adoption baseline tightened");
  } else if (shrunk.length > 0) {
    for (const { file, component, current, limit } of shrunk) {
      console.error(`${file}: ${component} dropped ${limit} → ${current}`);
    }
    console.error(
      "Migrated to Cladd — tighten the ratchet: node scripts/check-cladd-adoption.mjs --update",
    );
    process.exitCode = 1;
  } else {
    let total = 0;
    for (const counts of Object.values(usage)) {
      for (const count of Object.values(counts)) total += Number(count);
    }
    console.log(
      `Cladd adoption holds: ${String(total)} retiring shadcn import(s) left, none added`,
    );
  }
}
