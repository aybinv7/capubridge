import { computed, onMounted, reactive } from "vue";

const REPO = "aybinv7/capubridge";

/** Latest-release page — always resolves to the newest published stable release. */
export const RELEASES_LATEST = `https://github.com/${REPO}/releases/latest`;

export type PlatformKey = "macos-arm64" | "macos-x64" | "windows" | "linux";

export interface PlatformMeta {
  key: PlatformKey;
  /** OS family label, e.g. "macOS". */
  os: string;
  /** Architecture / variant label, e.g. "Apple Silicon". */
  arch: string;
  format: string;
  accent: string;
  /** Matches this platform's installer asset by file name. */
  match: (name: string) => boolean;
}

export const PLATFORMS: PlatformMeta[] = [
  {
    key: "macos-arm64",
    os: "macOS",
    arch: "Apple Silicon",
    format: ".dmg",
    accent: "#e8765a",
    match: (n) => n.endsWith(".dmg") && /aarch64|arm64/i.test(n),
  },
  {
    key: "macos-x64",
    os: "macOS",
    arch: "Intel",
    format: ".dmg",
    accent: "#e8765a",
    match: (n) => n.endsWith(".dmg") && /x64|x86_64|intel/i.test(n),
  },
  {
    key: "windows",
    os: "Windows",
    arch: "x64",
    format: ".exe",
    accent: "#71cbff",
    match: (n) => n.endsWith("-setup.exe") || n.endsWith(".exe"),
  },
  {
    key: "linux",
    os: "Linux",
    arch: "x64",
    format: ".AppImage",
    accent: "#8f86ff",
    match: (n) => n.endsWith(".AppImage"),
  },
];

type ReleaseAsset = { name: string; browser_download_url: string };
type Release = { tag_name?: string; html_url?: string; assets?: ReleaseAsset[] };

// Module-level singleton so the hero CTA and the download grid share one fetch.
const state = reactive({
  urls: Object.fromEntries(PLATFORMS.map((p) => [p.key, RELEASES_LATEST])) as Record<
    PlatformKey,
    string
  >,
  tag: null as string | null,
  loaded: false,
});

let started = false;

async function loadOnce() {
  if (started) return;
  started = true;
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!res.ok) return;
    const release = (await res.json()) as Release;
    state.tag = release.tag_name ?? null;
    const assets = release.assets ?? [];
    for (const platform of PLATFORMS) {
      const asset = assets.find((a) => platform.match(a.name));
      state.urls[platform.key] = asset?.browser_download_url ?? release.html_url ?? RELEASES_LATEST;
    }
  } catch {
    // Network/API failure: the default latest-release links already work.
  } finally {
    state.loaded = true;
  }
}

/** Best-effort detection of the visitor's platform from the user agent. */
function detectPlatform(): PlatformKey | null {
  if (typeof navigator === "undefined") return null;
  const ua = navigator.userAgent;
  if (/windows/i.test(ua)) return "windows";
  // Modern Macs report "MacIntel" even on Apple Silicon, so arch is not
  // reliably detectable — default to Apple Silicon (the common case) and let
  // the full grid offer the Intel build.
  if (/mac/i.test(ua)) return "macos-arm64";
  if (/linux/i.test(ua) && !/android/i.test(ua)) return "linux";
  return null;
}

export function useReleaseDownloads() {
  onMounted(loadOnce);

  const detected = detectPlatform();
  const primary = computed(() => {
    if (!detected) return null;
    const meta = PLATFORMS.find((p) => p.key === detected)!;
    return { meta, href: state.urls[detected] };
  });

  return {
    platforms: PLATFORMS,
    urls: state.urls,
    latestTag: computed(() => state.tag),
    detected,
    primary,
    releasesLatest: RELEASES_LATEST,
  };
}
