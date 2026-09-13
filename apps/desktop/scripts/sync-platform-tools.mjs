import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { access, cp, mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pipeline } from "node:stream/promises";
import { platformTools } from "./release-resources.mjs";

const scriptDir = import.meta.dirname;
const resourcesDir = path.resolve(scriptDir, "../src-tauri/resources/adb");

function adbBinaryName(platform) {
  return platform === "windows" ? "adb.exe" : "adb";
}

function resolvePlatforms(argv) {
  if (argv.includes("--all")) {
    return Object.keys(PLATFORM_URLS);
  }

  const platformArg = argv.find((arg) => arg.startsWith("--platform="));
  if (platformArg) {
    return platformArg
      .slice("--platform=".length)
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
  }

  switch (process.platform) {
    case "win32":
      return ["windows"];
    case "darwin":
      return ["darwin"];
    case "linux":
      return ["linux"];
    default:
      throw new Error(`Unsupported host platform: ${process.platform}`);
  }
}

async function downloadArchive(url, outputPath) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "capubridge-platform-tools-sync",
    },
  });
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }

  await pipeline(response.body, createWriteStream(outputPath));
}

async function verifyChecksum(filePath, algorithm, expected) {
  const hash = createHash(algorithm);
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  const actual = hash.digest("hex");
  if (actual !== expected)
    throw new Error(`${algorithm.toUpperCase()} mismatch for ${path.basename(filePath)}`);
}

function powershellQuote(value) {
  return `'${value.replace(/'/g, "''")}'`;
}

function extractArchive(zipPath, destinationPath) {
  const command =
    process.platform === "win32"
      ? {
          file: "powershell",
          args: [
            "-NoProfile",
            "-Command",
            `Expand-Archive -LiteralPath ${powershellQuote(zipPath)} -DestinationPath ${powershellQuote(destinationPath)} -Force`,
          ],
        }
      : {
          file: "unzip",
          args: ["-oq", zipPath, "-d", destinationPath],
        };

  const result = spawnSync(command.file, command.args, {
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new Error(`Failed to extract ${path.basename(zipPath)}`);
  }
}

async function syncPlatform(platform) {
  const resource = platformTools[platform];
  if (!resource) {
    throw new Error(`Unsupported platform key: ${platform}`);
  }

  const tempDir = await mkdtemp(path.join(os.tmpdir(), `capubridge-platform-tools-${platform}-`));
  const zipPath = path.join(tempDir, `${platform}.zip`);
  const targetDir = path.join(resourcesDir, platform);

  try {
    const stagedTargetDir = path.join(tempDir, "resources");
    await downloadArchive(resource.url, zipPath);
    await verifyChecksum(zipPath, resource.algorithm, resource.checksum);
    await mkdir(stagedTargetDir, { recursive: true });
    extractArchive(zipPath, stagedTargetDir);

    const adbPath = path.join(stagedTargetDir, "platform-tools", adbBinaryName(platform));
    await access(adbPath);
    await rm(targetDir, { recursive: true, force: true });
    await mkdir(path.dirname(targetDir), { recursive: true });
    await cp(stagedTargetDir, targetDir, { recursive: true });
    console.log(`[bundle:adb] ${platform} -> ${adbPath}`);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

const platforms = resolvePlatforms(process.argv.slice(2));

for (const platform of platforms) {
  await syncPlatform(platform);
}
