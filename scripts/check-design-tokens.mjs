import { readdir, readFile } from "node:fs/promises";
import { extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const sourceRoot = resolve(root, "apps/desktop/src");
const sourceExtensions = new Set([".ts", ".vue"]);

const utilityPrefixes =
  "text|bg|border|ring|fill|stroke|from|to|via|outline|decoration|divide|caret|shadow|accent";

export const rules = [
  {
    id: "arbitrary-text-size",
    message: "use the type scale (text-2xs … text-2xl) instead of a pixel or rem size",
    pattern: /\btext-\[\d+(?:\.\d+)?(?:px|rem)\]/g,
  },
  {
    id: "raw-state-palette",
    message:
      "use a semantic token (error, warning, success, info, signal-*) instead of a raw palette colour",
    pattern: new RegExp(
      `\\b(?:${utilityPrefixes})-(?:red|rose|amber|yellow|orange|emerald|green|lime|sky|blue)-\\d{2,3}\\b`,
      "g",
    ),
  },
];

function normalizedPath(path) {
  return path.replaceAll("\\", "/");
}

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) return collectFiles(path);
      return sourceExtensions.has(extname(entry.name)) ? [path] : [];
    }),
  );
  return files.flat();
}

export function findDesignTokenViolations(source, filename = "source.vue") {
  const violations = [];
  const lines = source.split(/\r\n|\r|\n/);
  lines.forEach((line, index) => {
    for (const rule of rules) {
      for (const match of line.matchAll(rule.pattern)) {
        violations.push({
          filename,
          line: index + 1,
          token: match[0],
          rule: rule.id,
          message: rule.message,
        });
      }
    }
  });
  return violations;
}

export async function runDesignTokenCheck() {
  const violations = [];
  for (const file of await collectFiles(sourceRoot)) {
    const source = await readFile(file, "utf8");
    const filename = normalizedPath(relative(root, file));
    violations.push(...findDesignTokenViolations(source, filename));
  }
  return violations;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const violations = await runDesignTokenCheck();
  if (violations.length > 0) {
    for (const violation of violations) {
      console.error(
        `${violation.filename}:${violation.line}: ${violation.token} — ${violation.message}`,
      );
    }
    process.exitCode = 1;
  } else {
    console.log("Design tokens enforced: type scale and semantic colours only");
  }
}
