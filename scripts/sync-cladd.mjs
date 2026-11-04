import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Copies cladd-vue (the owner's Vue port of Cladd) into `packages/cladd`.
 * cladd-vue stays the place where primitives are added and parity-tested against
 * upstream Cladd; this repo vendors the result so the app builds without it.
 *
 * Usage: node scripts/sync-cladd.mjs [--from <cladd-vue checkout>]
 */

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const targetDir = join(repoRoot, "packages", "cladd");

function sourceRoot() {
  const flag = process.argv.indexOf("--from");
  if (flag !== -1 && process.argv[flag + 1]) return resolve(process.argv[flag + 1]);
  if (process.env.CLADD_VUE_DIR) return resolve(process.env.CLADD_VUE_DIR);
  return resolve(repoRoot, "..", "cladd-vue");
}

const copied = [
  "src",
  "src/calendar/calendar.contracts.ts",
  "tests/components",
  "tests/foundations",
  "tests/support/mountTree.ts",
  "fixtures",
  "docs/architecture.md",
  "docs/components",
  "docs/extensions",
  "LICENSE",
  "THIRD_PARTY_NOTICES.md",
];

/**
 * Parts that need upstream reference data or extra runtime dependencies stay in cladd-vue.
 * The calendar contracts are copied back on their own: core component defaults import their types.
 */
const excluded = new Set([
  "src/calendar",
  "tests/components/calendar.test.ts",
  "fixtures/consumer-contracts.ts",
]);

function isExcluded(path, packageRoot) {
  const rel = relative(packageRoot, path).split("\\").join("/");
  return excluded.has(rel);
}

function gitHead(cwd) {
  const result = spawnSync("git", ["rev-parse", "HEAD"], { cwd, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`Cannot read cladd-vue HEAD in ${cwd}`);
  return result.stdout.trim();
}

function gitIsClean(cwd) {
  const result = spawnSync("git", ["status", "--porcelain", "--", "packages/ui"], {
    cwd,
    encoding: "utf8",
  });
  return result.status === 0 && result.stdout.trim() === "";
}

const claddVue = sourceRoot();
const packageRoot = join(claddVue, "packages", "ui");
if (!existsSync(join(packageRoot, "src", "index.ts"))) {
  console.error(`cladd-vue not found at ${claddVue} (pass --from or set CLADD_VUE_DIR)`);
  process.exit(1);
}
if (!gitIsClean(claddVue)) {
  console.error("cladd-vue has uncommitted changes in packages/ui; commit them before syncing.");
  process.exit(1);
}

const commit = gitHead(claddVue);
const upstreamPin =
  readFileSync(join(claddVue, "scripts", "reference-cladd.mjs"), "utf8").match(
    /const commit = '([0-9a-f]{40})'/,
  )?.[1] ?? "unknown";

for (const entry of copied) {
  const destination = join(targetDir, entry);
  rmSync(destination, { recursive: true, force: true });
  mkdirSync(dirname(destination), { recursive: true });
  cpSync(join(packageRoot, entry), destination, {
    recursive: true,
    filter: (path) => !isExcluded(path, packageRoot),
  });
}

writeFileSync(
  join(targetDir, "VENDORED.md"),
  `# Vendored cladd-vue

This package is a vendored copy of [cladd-vue](https://github.com/aybinv7/cladd-vue) \`packages/ui\`.
Do not edit \`src/\` here: add or fix primitives in cladd-vue (where they are parity-tested against
upstream Cladd), commit there, then run \`node scripts/sync-cladd.mjs\` from the repo root.

- cladd-vue commit: \`${commit}\`
- Upstream Cladd pin: \`${upstreamPin}\`
- Left in cladd-vue: the calendar components (need \`@vuepic/vue-datepicker\`; only their type
  contracts are vendored) and the parity suite
  (needs \`reference/cladd\` and the port manifests).
`,
);

console.log(`Synced cladd-vue ${commit.slice(0, 7)} into packages/cladd`);
