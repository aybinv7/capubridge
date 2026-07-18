import { readdir, readFile } from "node:fs/promises";
import { extname, relative, resolve } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const requireFromDesktop = createRequire(resolve(root, "apps/desktop/package.json"));
const { parse } = requireFromDesktop("@babel/parser");
const sourceRoot = resolve(root, "apps/desktop/src");
const sourceExtensions = new Set([".js", ".jsx", ".mjs", ".mts", ".ts", ".tsx", ".vue"]);

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

export function extractVueScripts(source) {
  const scripts = [];
  const openingPattern = /^<script(?:\s[^>]*)?>\s*$/gm;
  let opening;

  while ((opening = openingPattern.exec(source)) !== null) {
    const contentStart = openingPattern.lastIndex;
    const closingPattern = /^<\/script>\s*$/gm;
    closingPattern.lastIndex = contentStart;
    const closing = closingPattern.exec(source);
    if (!closing) {
      throw new Error(
        `Vue script block at line ${source.slice(0, opening.index).split(/\r\n|\r|\n/).length} is not closed`,
      );
    }
    scripts.push({
      source: source.slice(contentStart, closing.index),
      startLine: source.slice(0, contentStart).split(/\r\n|\r|\n/).length,
    });
    openingPattern.lastIndex = closingPattern.lastIndex;
  }

  return scripts;
}

function isUndefinedLike(node) {
  return (
    node === null ||
    (node.type === "Identifier" && node.name === "undefined") ||
    (node.type === "UnaryExpression" && node.operator === "void") ||
    node.type === "NullLiteral"
  );
}

function isSilentHandler(handler) {
  if (handler.type !== "ArrowFunctionExpression" && handler.type !== "FunctionExpression") {
    return false;
  }

  if (handler.body.type !== "BlockStatement") {
    return isUndefinedLike(handler.body);
  }

  const statements = handler.body.body.filter((statement) => statement.type !== "EmptyStatement");
  if (statements.length === 0) return true;
  if (statements.length !== 1) return false;

  const statement = statements[0];
  if (statement.type === "ReturnStatement") return isUndefinedLike(statement.argument);
  if (statement.type === "ExpressionStatement") return isUndefinedLike(statement.expression);
  return false;
}

function visit(node, onNode) {
  if (!node || typeof node !== "object") return;
  if (typeof node.type === "string") onNode(node);

  for (const [key, value] of Object.entries(node)) {
    if (key === "loc" || key === "start" || key === "end" || key === "extra") continue;
    if (Array.isArray(value)) {
      for (const item of value) visit(item, onNode);
    } else {
      visit(value, onNode);
    }
  }
}

function isCatchCall(node) {
  if (node.type !== "CallExpression" && node.type !== "OptionalCallExpression") return false;
  const callee = node.callee;
  if (callee?.type !== "MemberExpression" && callee?.type !== "OptionalMemberExpression")
    return false;
  if (!callee.computed && callee.property?.type === "Identifier") {
    return callee.property.name === "catch";
  }
  return callee.property?.type === "StringLiteral" && callee.property.value === "catch";
}

export function findSilentErrorHandlers(source, filename = "source.ts", startLine = 1) {
  const ast = parse(source, {
    sourceType: "module",
    plugins: ["typescript", "jsx", "decorators-legacy"],
    startLine,
  });
  const violations = [];

  visit(ast, (node) => {
    if (node.type === "CatchClause") {
      const statements = node.body.body.filter((statement) => statement.type !== "EmptyStatement");
      if (statements.length === 0) {
        violations.push({
          filename,
          line: node.loc?.start.line ?? startLine,
          kind: "empty catch clause",
        });
      }
      return;
    }

    if (isCatchCall(node) && isSilentHandler(node.arguments[0])) {
      violations.push({
        filename,
        line: node.loc?.start.line ?? startLine,
        kind: "silent Promise.catch handler",
      });
    }
  });

  return violations;
}

export async function runSilentErrorCheck() {
  const violations = [];

  for (const file of await collectFiles(sourceRoot)) {
    const filename = normalizedPath(relative(root, file));
    const content = await readFile(file, "utf8");
    const sources =
      extname(file) === ".vue" ? extractVueScripts(content) : [{ source: content, startLine: 1 }];

    try {
      for (const entry of sources) {
        violations.push(...findSilentErrorHandlers(entry.source, filename, entry.startLine));
      }
    } catch (error) {
      violations.push({
        filename,
        line: 1,
        kind: `parse failure: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  if (violations.length > 0) {
    for (const violation of violations.sort((a, b) =>
      `${a.filename}:${a.line}`.localeCompare(`${b.filename}:${b.line}`),
    )) {
      console.error(`${violation.filename}:${violation.line}: ${violation.kind}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log("Operational catch handlers must record, surface, recover, or rethrow failures");
}

const executedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (executedPath === fileURLToPath(import.meta.url)) {
  await runSilentErrorCheck();
}
