import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { access, cp, mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pipeline } from "node:stream/promises";
import { scrcpy } from "./release-resources.mjs";

const scriptDir = import.meta.dirname;

function powershellQuote(value) {
  return `'${value.replace(/'/g, "''")}'`;
}

async function fetchResponse(url) {
  const response = await fetch(url, {
    headers: {
      accept: "application/vnd.github+json",
      "user-agent": "capubridge-scrcpy-sync",
      "x-github-api-version": "2022-11-28",
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }
  return response;
}

function defaultTarget() {
  const platform = { win32: "windows", linux: "linux", darwin: "macos" }[process.platform];
  const arch = { x64: "x64", arm64: "arm64" }[process.arch];
  return platform && arch ? `${platform}-${arch}` : undefined;
}

async function sha256(filePath) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}

async function main() {
  const requestedTarget = process.env.CAPUBRIDGE_SCRCPY_TARGET || defaultTarget();
  const target = scrcpy[requestedTarget];
  if (!target) throw new Error(`Unsupported scrcpy bundle target: ${requestedTarget ?? "unknown"}`);
  const targetDir = path.resolve(scriptDir, `../src-tauri/resources/scrcpy/${requestedTarget}`);

  const tempDir = await mkdtemp(path.join(os.tmpdir(), "capubridge-scrcpy-"));
  const assetName = path.basename(new URL(target.url).pathname);
  const zipPath = path.join(tempDir, assetName);
  const extractDir = path.join(tempDir, "extract");

  try {
    await mkdir(extractDir, { recursive: true });
    const archive = await fetchResponse(target.url);
    if (!archive.body) throw new Error("scrcpy archive response was empty");
    await pipeline(archive.body, createWriteStream(zipPath));
    const actualDigest = await sha256(zipPath);
    if (actualDigest !== target.checksum) {
      throw new Error(`SHA-256 mismatch for ${assetName}`);
    }

    const result =
      target.archiveSuffix === ".zip"
        ? spawnSync(
            "powershell",
            [
              "-NoProfile",
              "-Command",
              `Expand-Archive -LiteralPath ${powershellQuote(zipPath)} -DestinationPath ${powershellQuote(extractDir)} -Force`,
            ],
            { stdio: "inherit" },
          )
        : spawnSync("tar", ["-xzf", zipPath, "-C", extractDir], { stdio: "inherit" });
    if (result.status !== 0) throw new Error(`Failed to extract ${assetName}`);

    const archiveRoot = path.join(extractDir, assetName.slice(0, -target.archiveSuffix.length));
    await access(path.join(archiveRoot, target.binary));
    await rm(targetDir, { recursive: true, force: true });
    await mkdir(path.dirname(targetDir), { recursive: true });
    await cp(archiveRoot, targetDir, { recursive: true });
    console.log(`[bundle:scrcpy] ${assetName} -> ${targetDir}`);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

await main();
