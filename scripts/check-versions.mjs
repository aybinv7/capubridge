import { readFile } from "node:fs/promises";

const rootUrl = new URL("../", import.meta.url);

async function readJson(path) {
  return JSON.parse(await readFile(new URL(path, rootUrl), "utf8"));
}

const rootPackage = await readJson("package.json");
const desktopPackage = await readJson("apps/desktop/package.json");
const cdpProtocolPackage = await readJson("packages/cdp-protocol/package.json");
const tauriConfig = await readJson("apps/desktop/src-tauri/tauri.conf.json");
const cargoManifest = await readFile(new URL("apps/desktop/src-tauri/Cargo.toml", rootUrl), "utf8");
const readme = await readFile(new URL("README.md", rootUrl), "utf8");
const cargoVersion = cargoManifest.match(/^version\s*=\s*"([^"]+)"/m)?.[1];
const expectedVersion = rootPackage.version;
const versions = new Map([
  ["root package", expectedVersion],
  ["desktop package", desktopPackage.version],
  ["CDP protocol package", cdpProtocolPackage.version],
  ["Tauri config", tauriConfig.version],
  ["Cargo manifest", cargoVersion],
]);
const mismatches = [...versions]
  .filter(([, version]) => version !== expectedVersion)
  .map(([source, actual]) => ({ source, expected: expectedVersion, actual }));

if (!readme.includes(`**v${expectedVersion}**`)) {
  mismatches.push({
    source: "README status",
    expected: `**v${expectedVersion}**`,
    actual: "missing",
  });
}

if (process.env.GITHUB_REF_TYPE === "tag") {
  const expectedTag = `v${expectedVersion}`;
  const actualTag = process.env.GITHUB_REF_NAME;

  if (actualTag !== expectedTag) {
    mismatches.push({ source: "release tag", expected: expectedTag, actual: actualTag });
  }
}

if (mismatches.length > 0) {
  for (const { source, expected, actual } of mismatches) {
    console.error(`${source}: expected ${expected}, received ${actual ?? "missing"}`);
  }

  process.exitCode = 1;
} else {
  console.log(`CapuBridge version ${expectedVersion} is synchronized`);
}
