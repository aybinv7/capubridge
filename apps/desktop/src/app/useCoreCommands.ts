import { onUnmounted } from "vue";
import { useRouter } from "vue-router";
import {
  Bug,
  Cable,
  Keyboard,
  Monitor,
  Moon,
  PanelLeft,
  RefreshCw,
  RotateCw,
  ScreenShare,
  ScrollText,
  Search,
  Smartphone,
  SquareTerminal,
  Sun,
  Terminal,
  TriangleAlert,
  ChartNoAxesGantt,
  Zap,
} from "lucide-vue-next";
import { primaryNavigationFeatures, utilityNavigationFeatures } from "@/app/feature-registry";
import { useCommandsStore } from "@/stores/commands.store";
import { useUIStore } from "@/stores/ui.store";
import { useDockStore } from "@/stores/dock.store";
import { useMirrorStore } from "@/stores/mirror.store";
import { useTimelineStripStore } from "@/stores/timelineStrip.store";
import { useThemeStore } from "@/stores/theme.store";
import { useDevicesStore } from "@/stores/devices.store";
import { useDeviceNamesStore } from "@/stores/deviceNames.store";
import { useTargetsStore } from "@/stores/targets.store";
import { useActiveContextStore } from "@/stores/activeContext.store";
import { useTargetActivation } from "@/composables/useTargetActivation";
import { themes } from "@/themes/registry";
import type { Command } from "@/lib/commands/types";
import type { DockTab } from "@/types/dock.types";

const DOCK_TABS: Array<{ tab: DockTab; title: string; icon: Command["icon"] }> = [
  { tab: "logcat", title: "Show Logcat", icon: ScrollText },
  { tab: "console", title: "Show Console", icon: Terminal },
  { tab: "repl", title: "Show REPL", icon: SquareTerminal },
  { tab: "exceptions", title: "Show Exceptions", icon: TriangleAlert },
];

/** Registers the shell's own commands: navigation, view, appearance, devices and targets. */
async function openDevtools() {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("plugin:webview|internal_toggle_devtools");
  } catch (error) {
    console.warn("Failed to open developer tools", error);
  }
}

export function useCoreCommands(): void {
  const router = useRouter();
  const commands = useCommandsStore();
  const ui = useUIStore();
  const dock = useDockStore();
  const mirror = useMirrorStore();
  const timelineStrip = useTimelineStripStore();
  const theme = useThemeStore();
  const devices = useDevicesStore();
  const deviceNames = useDeviceNamesStore();
  const targets = useTargetsStore();
  const context = useActiveContextStore();
  const { activateTarget } = useTargetActivation();

  const disposers = [
    commands.registerProvider("core.navigate", () => [
      ...primaryNavigationFeatures.map<Command>((feature) => ({
        id: `nav.${feature.id}`,
        title: `Go to ${feature.label}`,
        group: "Navigate",
        icon: feature.icon,
        binding: feature.goKey ? `g ${feature.goKey}` : undefined,
        keywords: [feature.label, feature.path],
        detail: feature.maturity === "stable" ? undefined : feature.maturity,
        run: () => router.push(feature.path),
      })),
      ...utilityNavigationFeatures.map<Command>((feature) => ({
        id: `nav.${feature.id}`,
        title: `Open ${feature.label}`,
        group: "Navigate",
        icon: feature.icon,
        binding: feature.id === "settings" ? "mod+," : undefined,
        global: feature.id === "settings",
        run: () => router.push(feature.path),
      })),
    ]),

    commands.registerProvider("core.view", () => [
      {
        id: "view.palette",
        title: "Command palette",
        group: "View",
        icon: Search,
        binding: "mod+k",
        global: true,
        run: () => commands.openPalette(),
      },
      {
        id: "view.actions",
        title: "Actions on this screen",
        group: "View",
        icon: Zap,
        binding: "mod+.",
        global: true,
        run: () => commands.openPalette(":"),
      },
      {
        id: "view.reload",
        title: "Reload Capubridge",
        group: "View",
        icon: RotateCw,
        detail: "F5",
        keywords: ["refresh", "restart", "f5", "ctrl r"],
        run: () => window.location.reload(),
      },
      {
        id: "view.devtools",
        title: "Open developer tools",
        group: "View",
        icon: Bug,
        binding: "mod+shift+i",
        global: true,
        keywords: ["inspect", "console", "debug"],
        when: () => import.meta.env.DEV,
        run: () => openDevtools(),
      },
      {
        id: "view.toggle-rail",
        title: ui.railHidden ? "Show navigation rail" : "Hide navigation rail",
        group: "View",
        icon: PanelLeft,
        binding: "mod+b",
        run: () => ui.toggleRail(),
      },
      {
        id: "view.toggle-dock",
        title: dock.isOpen ? "Hide console dock" : "Show console dock",
        group: "View",
        icon: Terminal,
        binding: "mod+j",
        global: true,
        run: () => dock.toggleDock(),
      },
      {
        id: "view.toggle-timeline",
        title: timelineStrip.hidden ? "Show the timeline" : "Hide the timeline",
        group: "View",
        icon: ChartNoAxesGantt,
        binding: "mod+shift+j",
        global: true,
        keywords: ["timeline", "strip", "markers", "history"],
        run: () => timelineStrip.toggleHidden(),
      },
      {
        id: "view.toggle-device-pane",
        title: mirror.isOpen ? "Close device pane" : "Open device pane",
        group: "View",
        icon: ScreenShare,
        when: () => context.device?.status === "online" || context.target !== null,
        run: () => mirror.toggle(),
      },
      ...DOCK_TABS.map<Command>(({ tab, title, icon }) => ({
        id: `dock.${tab}`,
        title,
        group: "View",
        icon,
        keywords: ["dock", tab],
        run: () => dock.openDock(tab),
      })),
      {
        id: "help.shortcuts",
        title: "Keyboard shortcuts",
        group: "Help",
        icon: Keyboard,
        keywords: ["keys", "bindings", "hotkeys"],
        run: () => router.push("/settings/shortcuts"),
      },
    ]),

    commands.registerProvider("core.appearance", () =>
      themes.map<Command>((entry) => ({
        id: `theme.${entry.id}`,
        title: `Theme: ${entry.label}`,
        group: "Appearance",
        icon: entry.id === "high-contrast" ? Monitor : entry.mode === "dark" ? Moon : Sun,
        keywords: ["theme", "appearance", entry.mode],
        when: () => theme.themeId !== entry.id,
        run: () => theme.setTheme(entry.id),
      })),
    ),

    commands.registerProvider("core.devices", () => [
      {
        id: "device.manager",
        title: "Choose device or target",
        group: "Devices",
        icon: Cable,
        binding: "mod+shift+d",
        keywords: ["device manager", "connect", "pair", "wifi", "emulator", "target"],
        run: () => ui.openDeviceManager(),
      },
      {
        id: "device.refresh",
        title: "Refresh devices",
        group: "Devices",
        icon: RefreshCw,
        keywords: ["adb", "rescan"],
        run: () => devices.refreshDevices(),
      },
      ...devices.devices.map<Command>((device) => ({
        id: `device.${device.serial}`,
        title: deviceNames.nameOf(device),
        group: "Devices",
        icon: Smartphone,
        detail: `${device.serial} · ${device.isStale ? "stale" : device.status}`,
        dormant: device.isStale || device.status !== "online",
        keywords: [device.serial, device.model, device.connectionType, "device", "switch"],
        when: () => context.device?.serial !== device.serial,
        run: () => devices.selectDevice(device),
      })),
    ]),

    commands.registerProvider("core.targets", () =>
      targets.visibleTargets.map<Command>((target) => ({
        id: `target.${target.id}`,
        title: target.title?.trim() || target.url,
        group: "Targets",
        icon: Bug,
        detail: target.packageName ?? target.url,
        keywords: [target.url, target.packageName ?? "", "target", "inspect", "webview"],
        when: () => context.target?.id !== target.id,
        run: () => activateTarget(target),
      })),
    ),
  ];

  onUnmounted(() => disposers.forEach((dispose) => dispose()));
}
