import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const remote = "https://github.com/cladd-ui/cladd.git";
const commit = "fadd8efe935111f31d7c933238db5ce5d3a55d71";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const targetDir = join(repoRoot, "reference", "cladd");

function git(args, cwd) {
  return spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function gitOrThrow(args, cwd, step) {
  const result = git(args, cwd);

  if (result.error) {
    throw new Error(`${step} could not start: ${result.error.message}`);
  }

  if (result.status !== 0) {
    const detail = `${result.stderr ?? ""}${result.stdout ?? ""}`.trim();
    throw new Error(`${step} failed (git ${args.join(" ")})\n${detail}`);
  }

  return (result.stdout ?? "").trim();
}

function readHead(cwd) {
  const result = git(["rev-parse", "HEAD"], cwd);
  return result.status === 0 ? result.stdout.trim() : undefined;
}

function note(message) {
  process.stderr.write(`${message}\n`);
}

function fail(lines) {
  process.stderr.write(`${lines.join("\n")}\n`);
  process.exit(1);
}

if (existsSync(join(targetDir, ".git"))) {
  const head = readHead(targetDir);

  if (head === commit) {
    process.stdout.write(`${targetDir}\n`);
    process.exit(0);
  }

  fail([
    "Pinned Cladd reference is at the wrong commit.",
    `  path     ${targetDir}`,
    `  expected ${commit}`,
    `  found    ${head ?? "unresolvable HEAD"}`,
    "",
    "Refusing to rewrite a checkout this script did not create. Fix it with:",
    `  rm -rf "${targetDir}" && vp run reference:cladd`,
  ]);
}

if (existsSync(targetDir) && readdirSync(targetDir).length > 0) {
  fail([
    "Pinned Cladd reference path exists but is not a git checkout.",
    `  path ${targetDir}`,
    "",
    "Remove it and retry:",
    `  rm -rf "${targetDir}" && vp run reference:cladd`,
  ]);
}

note(`Vendoring ${remote} at ${commit}`);

try {
  mkdirSync(targetDir, { recursive: true });
  gitOrThrow(["init", "--quiet"], targetDir, "git init");
  gitOrThrow(["remote", "add", "origin", remote], targetDir, "git remote add");

  const shallow = git(["fetch", "--quiet", "--depth", "1", "origin", commit], targetDir);

  if (shallow.status === 0) {
    gitOrThrow(["checkout", "--quiet", "--detach", "FETCH_HEAD"], targetDir, "git checkout");
  } else {
    note("Fetching a single commit was rejected by the remote, falling back to a full fetch.");
    gitOrThrow(["fetch", "--quiet", "--tags", "origin"], targetDir, "git fetch");
    gitOrThrow(["checkout", "--quiet", "--detach", commit], targetDir, "git checkout");
  }

  const head = readHead(targetDir);

  if (head !== commit) {
    throw new Error(`checked-out HEAD is ${head ?? "unresolvable"}, expected ${commit}`);
  }
} catch (error) {
  rmSync(targetDir, { force: true, recursive: true });
  fail([
    "Failed to vendor the pinned Cladd reference.",
    error instanceof Error ? error.message : String(error),
    "",
    "Retry once network access to github.com is available:",
    "  vp run reference:cladd",
  ]);
}

process.stdout.write(`${targetDir}\n`);
