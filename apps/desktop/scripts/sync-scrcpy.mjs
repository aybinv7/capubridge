import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { access, mkdir, mkdtemp, rename, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pipeline } from "node:stream/promises";

const RELEASE_API = "https://api.github.com/repos/Genymobile/scrcpy/releases/latest";
const scriptDir = import.meta.dirname;
const TARGETS = {
  "windows-x64": {
    asset: /^scrcpy-win64-v.*\.zip$/,
    binary: "scrcpy.exe",
    archiveSuffix: ".zip",
  },
  "linux-x64": {
    asset: /^scrcpy-linux-x86_64-v.*\.tar\.gz$/,
    binary: "scrcpy",
    archiveSuffix: ".tar.gz",
  },
  "macos-x64": {
    asset: /^scrcpy-macos-x86_64-v.*\.tar\.gz$/,
    binary: "scrcpy",
    archiveSuffix: ".tar.gz",
  },
  "macos-arm64": {
    asset: /^scrcpy-macos-aarch64-v.*\.tar\.gz$/,
    binary: "scrcpy",
    archiveSuffix: ".tar.gz",
  },
};

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
  const target = TARGETS[requestedTarget];
  if (!target) throw new Error(`Unsupported scrcpy bundle target: ${requestedTarget ?? "unknown"}`);
  const targetDir = path.resolve(scriptDir, `../src-tauri/resources/scrcpy/${requestedTarget}`);

  const release = await (await fetchResponse(RELEASE_API)).json();
  const asset = release.assets?.find((candidate) => target.asset.test(candidate.name));
  if (!asset?.browser_download_url) {
    throw new Error(`The latest scrcpy release does not contain a ${requestedTarget} archive`);
  }

  const tempDir = await mkdtemp(path.join(os.tmpdir(), "capubridge-scrcpy-"));
  const zipPath = path.join(tempDir, asset.name);
  const extractDir = path.join(tempDir, "extract");

  try {
    await mkdir(extractDir, { recursive: true });
    const archive = await fetchResponse(asset.browser_download_url);
    if (!archive.body) throw new Error("scrcpy archive response was empty");
    await pipeline(archive.body, createWriteStream(zipPath));
    if (asset.digest?.startsWith("sha256:")) {
      const actualDigest = await sha256(zipPath);
      if (actualDigest !== asset.digest.slice("sha256:".length)) {
        throw new Error(`SHA-256 mismatch for ${asset.name}`);
      }
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
    if (result.status !== 0) throw new Error(`Failed to extract ${asset.name}`);

    const archiveRoot = path.join(extractDir, asset.name.slice(0, -target.archiveSuffix.length));
    await access(path.join(archiveRoot, target.binary));
    await rm(targetDir, { recursive: true, force: true });
    await mkdir(path.dirname(targetDir), { recursive: true });
    await rename(archiveRoot, targetDir);
    console.log(`[bundle:scrcpy] ${release.tag_name} -> ${targetDir}`);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

await main();
