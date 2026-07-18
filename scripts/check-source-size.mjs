import { readdir, readFile } from "node:fs/promises";
import { extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const SOURCE_LINE_LIMIT = 800;

const root = fileURLToPath(new URL("../", import.meta.url));
const baselineUrl = new URL("../architecture/source-size-baseline.json", import.meta.url);
const scanRoots = ["apps", "packages", "scripts"];
const ignoredDirectories = new Set([".git", ".vite", "coverage", "dist", "node_modules", "target"]);
const sourceExtensions = new Set([
  ".cjs",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".mts",
  ".rs",
  ".ts",
  ".tsx",
  ".vue",
]);

function normalizedPath(path) {
  return path.replaceAll("\\", "/");
}

export function countPhysicalLines(content) {
  if (content.length === 0) return 0;
  const newlineCount = content.match(/\r\n|\r|\n/g)?.length ?? 0;
  return newlineCount + (/\r\n$|\r$|\n$/.test(content) ? 0 : 1);
}

async function collectSourceFiles(directory) {
  if (normalizedPath(relative(root, directory)) === "apps/docs/.vitepress/cache") return [];
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      if (entry.isDirectory() && ignoredDirectories.has(entry.name)) return [];
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) return collectSourceFiles(path);
      return sourceExtensions.has(extname(entry.name)) ? [path] : [];
    }),
  );
  return files.flat();
}

export function evaluateSourceSizeBoundary(files, baseline) {
  const errors = [];
  if (baseline.threshold !== SOURCE_LINE_LIMIT) {
    errors.push(
      `Baseline threshold must remain ${SOURCE_LINE_LIMIT}; received ${String(baseline.threshold)}`,
    );
  }

  if (!Array.isArray(baseline.exceptions)) {
    return [...errors, "Baseline exceptions must be an array"];
  }

  const observed = new Map(files.map((file) => [normalizedPath(file.path), file.lines]));
  const approved = new Map();

  for (const exception of baseline.exceptions) {
    const path = normalizedPath(exception.path ?? "");
    if (!path || approved.has(path)) {
      errors.push(`Baseline path must be present and unique: ${path || "<empty>"}`);
      continue;
    }
    approved.set(path, exception);

    if (!Number.isInteger(exception.maxLines) || exception.maxLines <= SOURCE_LINE_LIMIT) {
      errors.push(`Baseline maxLines must exceed ${SOURCE_LINE_LIMIT}: ${path}`);
    }
    if (typeof exception.owner !== "string" || exception.owner.trim().length === 0) {
      errors.push(`Baseline owner is required: ${path}`);
    }
    if (typeof exception.rationale !== "string" || exception.rationale.trim().length < 20) {
      errors.push(`Baseline rationale must explain exception: ${path}`);
    }

    const currentLinesValue = observed.get(path);
    const currentLines = typeof currentLinesValue === "number" ? currentLinesValue : undefined;
    if (currentLines === undefined) {
      errors.push(`Remove stale source-size exception for missing file: ${path}`);
    } else if (currentLines <= SOURCE_LINE_LIMIT) {
      errors.push(`Remove resolved source-size exception: ${path} (${String(currentLines)} lines)`);
    } else if (currentLines > exception.maxLines) {
      errors.push(
        `Unapproved source growth: ${path} is ${String(currentLines)} lines; approved maximum is ${String(exception.maxLines)}`,
      );
    }
  }

  for (const [path, lines] of observed) {
    if (lines > SOURCE_LINE_LIMIT && !approved.has(path)) {
      errors.push(
        `New oversized source requires split or approval: ${String(path)} (${String(lines)} lines)`,
      );
    }
  }

  return errors.sort();
}

export async function runSourceSizeCheck() {
  const files = (
    await Promise.all(scanRoots.map((scanRoot) => collectSourceFiles(resolve(root, scanRoot))))
  ).flat();
  const measured = await Promise.all(
    files.map(async (path) => ({
      path: normalizedPath(relative(root, path)),
      lines: countPhysicalLines(await readFile(path, "utf8")),
    })),
  );
  const baseline = JSON.parse(await readFile(baselineUrl, "utf8"));
  const errors = evaluateSourceSizeBoundary(measured, baseline);

  if (errors.length > 0) {
    for (const error of errors) console.error(error);
    process.exitCode = 1;
    return;
  }

  console.log(
    `Source-size boundary enforced at ${SOURCE_LINE_LIMIT} lines with ${baseline.exceptions.length} reviewed exceptions`,
  );
}

const executedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (executedPath === fileURLToPath(import.meta.url)) {
  await runSourceSizeCheck();
}
