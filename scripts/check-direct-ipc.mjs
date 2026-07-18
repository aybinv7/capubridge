import { readdir, readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const sourceRoot = resolve(root, "apps/desktop/src");
const allowedAdapter = "runtime/ipc/client.ts";
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

for (const file of await collectFiles(sourceRoot)) {
  const extension = file.slice(file.lastIndexOf("."));

  if (!sourceExtensions.has(extension)) {
    continue;
  }

  const sourcePath = relative(sourceRoot, file).replaceAll("\\", "/");

  if (sourcePath === allowedAdapter) {
    continue;
  }

  const content = await readFile(file, "utf8");
  const directInvoke =
    /import\s*\{[^}]*\binvoke\b[^}]*\}\s*from\s*["']@tauri-apps\/api\/core["']/.test(content);
  const directListen =
    /import\s*\{[^}]*\blisten\b[^}]*\}\s*from\s*["']@tauri-apps\/api\/event["']/.test(content);

  if (directInvoke || directListen) {
    violations.push(
      `${sourcePath}: ${directInvoke ? "invoke" : ""}${directInvoke && directListen ? ", " : ""}${directListen ? "listen" : ""}`,
    );
  }
}

if (violations.length > 0) {
  for (const violation of violations.sort()) {
    console.error(`Direct Tauri IPC import: ${violation}`);
  }

  process.exitCode = 1;
} else {
  console.log("Direct Tauri invoke/listen imports are isolated to the typed IPC adapter");
}
