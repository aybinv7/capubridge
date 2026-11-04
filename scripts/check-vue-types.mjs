import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compareWithBaseline } from "./check-cladd-adoption.mjs";

/**
 * `vp check` lint/type-checks TypeScript but not Vue templates. This runs vue-tsc
 * over the desktop app and ratchets template and script errors per file: none may
 * be added, and fixed files must tighten the baseline.
 *
 * Usage: node scripts/check-vue-types.mjs [--update | --seed]
 */

const root = fileURLToPath(new URL("../", import.meta.url));
const desktop = resolve(root, "apps/desktop");
const baselinePath = resolve(root, "scripts/vue-types-baseline.json");
const vueTsc = resolve(desktop, "node_modules/vue-tsc/bin/vue-tsc.js");

const errorLine = /^(src\/[^(]+)\((\d+),(\d+)\): error (TS\d+): (.*)$/;

/** Groups vue-tsc output into `{ file: { errors: n } }` plus the raw messages. */
export function parseVueTscOutput(output) {
  const usage = {};
  const messages = [];
  for (const line of output.split(/\r?\n/)) {
    const match = errorLine.exec(line);
    if (!match) continue;
    const file = `apps/desktop/${match[1]}`;
    usage[file] = { errors: (usage[file]?.errors ?? 0) + 1 };
    messages.push({ file, line: Number(match[2]), code: match[4], text: match[5] });
  }
  return { usage, messages };
}

function sorted(usage) {
  return Object.fromEntries(
    Object.keys(usage)
      .sort()
      .map((file) => [file, usage[file]]),
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  if (!existsSync(vueTsc)) {
    console.error("vue-tsc is not installed in apps/desktop (run vp install)");
    process.exit(1);
  }
  const run = spawnSync(process.execPath, [vueTsc, "--noEmit", "-p", "tsconfig.json"], {
    cwd: desktop,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (run.error) throw run.error;
  const { usage, messages } = parseVueTscOutput(`${run.stdout}\n${run.stderr}`);

  let baseline = null;
  try {
    baseline = JSON.parse(await readFile(baselinePath, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  if (baseline === null) {
    if (!process.argv.includes("--seed")) {
      console.error("No vue-types baseline: run node scripts/check-vue-types.mjs --seed once");
      process.exit(1);
    }
    await writeFile(baselinePath, `${JSON.stringify(sorted(usage), null, 2)}\n`);
    console.log(`Vue types baseline seeded with ${messages.length} existing error(s)`);
    process.exit(0);
  }

  const { grown, shrunk } = compareWithBaseline(usage, baseline);
  if (grown.length > 0) {
    const grownFiles = new Set(grown.map((entry) => entry.file));
    for (const message of messages.filter((entry) => grownFiles.has(entry.file))) {
      console.error(`${message.file}:${message.line} ${message.code} ${message.text}`);
    }
    console.error(`New Vue type errors in ${grownFiles.size} file(s)`);
    process.exitCode = 1;
  } else if (process.argv.includes("--update")) {
    await writeFile(baselinePath, `${JSON.stringify(sorted(usage), null, 2)}\n`);
    console.log(`Vue types baseline tightened to ${messages.length} error(s)`);
  } else if (shrunk.length > 0) {
    for (const { file, current, limit } of shrunk) console.error(`${file}: ${limit} → ${current}`);
    console.error(
      "Vue type errors fixed — tighten the ratchet: node scripts/check-vue-types.mjs --update",
    );
    process.exitCode = 1;
  } else {
    console.log(`Vue types hold: ${messages.length} known error(s), none added`);
  }
}
