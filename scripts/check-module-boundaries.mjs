import { readdir, readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const modulesRoot = resolve(root, "apps/desktop/src/modules");
const baseline = new Set(
  JSON.parse(
    await readFile(
      new URL("../architecture/module-boundary-baseline.json", import.meta.url),
      "utf8",
    ),
  ),
);
const sourceExtensions = new Set([".ts", ".tsx", ".vue"]);

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = resolve(directory, entry.name);
      return entry.isDirectory() ? collectFiles(path) : [path];
    }),
  );

  return files.flat();
}

const violations = [];
const observed = new Set();

for (const file of await collectFiles(modulesRoot)) {
  const extension = file.slice(file.lastIndexOf("."));

  if (!sourceExtensions.has(extension)) {
    continue;
  }

  const sourcePath = relative(modulesRoot, file).replaceAll("\\", "/");
  const sourceModule = sourcePath.split("/")[0];
  const content = await readFile(file, "utf8");
  const imports = content.matchAll(/["']@\/modules\/([^/]+)\/([^"']+)["']/g);

  for (const match of imports) {
    const targetModule = match[1];

    if (targetModule === sourceModule) {
      continue;
    }

    const key = `${sourcePath}::@/modules/${targetModule}/${match[2]}`;
    observed.add(key);

    if (!baseline.has(key)) {
      violations.push(key);
    }
  }
}

const resolvedExceptions = [...baseline].filter((key) => !observed.has(key));

if (violations.length > 0 || resolvedExceptions.length > 0) {
  for (const violation of violations.sort()) {
    console.error(`Forbidden cross-module import: ${violation}`);
  }

  for (const exception of resolvedExceptions.sort((left, right) =>
    String(left).localeCompare(String(right)),
  )) {
    console.error(`Remove resolved module exception: ${String(exception)}`);
  }

  process.exitCode = 1;
} else {
  console.log(`Module boundaries enforced with ${baseline.size} migration exceptions`);
}
