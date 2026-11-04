import { readdir, readFile } from "node:fs/promises";
import { extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const sourceRoot = resolve(root, "apps/desktop/src-tauri/src");

const commandAttributePattern = /^\s*#\[tauri::command\b/;
const attributeStartPattern = /^\s*#!?\[/;
const commentPattern = /^\s*(\/\/|\/\*|\*)/;
const functionPattern =
  /^\s*(?:pub(?:\([^)]*\))?\s+)?(?:const\s+)?(async\s+)?(?:unsafe\s+)?(?:extern\s+"[^"]*"\s+)?fn\s+([A-Za-z_][A-Za-z0-9_]*)/;

function normalizedPath(path) {
  return path.replaceAll("\\", "/");
}

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) return collectFiles(path);
      return extname(entry.name) === ".rs" ? [path] : [];
    }),
  );
  return files.flat();
}

function skipAttribute(lines, start) {
  let depth = 0;
  for (let index = start; index < lines.length; index += 1) {
    for (const character of lines[index]) {
      if (character === "[") depth += 1;
      else if (character === "]") depth -= 1;
    }
    if (depth <= 0) return index + 1;
  }
  return lines.length;
}

export function findSyncCommands(source, filename = "source.rs") {
  const lines = source.split(/\r\n|\r|\n/);
  const violations = [];

  for (let index = 0; index < lines.length; index += 1) {
    if (!commandAttributePattern.test(lines[index])) continue;

    let cursor = skipAttribute(lines, index);
    while (cursor < lines.length) {
      const line = lines[cursor];
      if (line.trim() === "" || commentPattern.test(line)) {
        cursor += 1;
        continue;
      }
      if (attributeStartPattern.test(line)) {
        cursor = skipAttribute(lines, cursor);
        continue;
      }
      break;
    }

    const declaration = lines[cursor] ?? "";
    const match = functionPattern.exec(declaration);
    if (!match) {
      violations.push({
        filename,
        line: index + 1,
        kind: "tauri command attribute is not followed by a function declaration",
      });
      continue;
    }
    if (!match[1]) {
      violations.push({
        filename,
        line: cursor + 1,
        kind: `synchronous tauri command \`${match[2]}\` must be declared \`async fn\``,
      });
    }
  }

  return violations;
}

export async function runAsyncCommandCheck() {
  const violations = [];

  for (const file of await collectFiles(sourceRoot)) {
    const filename = normalizedPath(relative(root, file));
    violations.push(...findSyncCommands(await readFile(file, "utf8"), filename));
  }

  if (violations.length > 0) {
    for (const violation of violations.sort(
      (a, b) => a.filename.localeCompare(b.filename) || a.line - b.line,
    )) {
      console.error(`${violation.filename}:${violation.line}: ${violation.kind}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log("Tauri commands must be async so blocking work never runs on the main thread");
}

const executedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (executedPath === fileURLToPath(import.meta.url)) {
  await runAsyncCommandCheck();
}
