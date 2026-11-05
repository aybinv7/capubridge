import { useRouter } from "vue-router";
import { toast } from "vue-sonner";
import {
  ArrowUpRight,
  CircleStop,
  Copy,
  Eraser,
  LayoutList,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
} from "lucide-vue-next";
import { useCommandProvider } from "@/composables/useCommandProvider";
import type { AppSession } from "./appSession";
import { openLabel } from "./lifecycle/lifecycle";

/** The App route's palette commands, offered while an app is selected. */
export function useAppCommands(session: AppSession) {
  const router = useRouter();
  const { app, process, lifecycle } = session;
  const hasApp = () => app.subject.value !== null;

  async function copyPackage() {
    try {
      await navigator.clipboard.writeText(app.packageName.value);
      toast.success("Package name copied");
    } catch (err) {
      toast.error("Could not copy the package name", { description: String(err) });
    }
  }

  async function refresh() {
    await app.details.refetch();
  }

  useCommandProvider("screen.app", () => {
    const name = app.name.value;
    return [
      {
        id: "app.open",
        title: `${openLabel(lifecycle.inBackground.value)}: ${name}`,
        group: "App",
        icon: lifecycle.inBackground.value ? ArrowUpRight : Play,
        screen: true,
        keywords: ["launch", "start", "foreground"],
        when: hasApp,
        run: lifecycle.open,
      },
      {
        id: "app.restart",
        title: `Restart ${name}`,
        group: "App",
        icon: RotateCcw,
        screen: true,
        keywords: ["relaunch", "reload", "cold start"],
        when: hasApp,
        run: lifecycle.restart,
      },
      {
        id: "app.force-stop",
        title: `Force stop ${name}`,
        group: "App",
        icon: CircleStop,
        screen: true,
        keywords: ["kill", "stop"],
        when: hasApp,
        run: () => lifecycle.request("forceStop"),
      },
      {
        id: "app.clear-data",
        title: `Clear the data of ${name}`,
        group: "App",
        icon: Eraser,
        screen: true,
        keywords: ["wipe", "reset", "pm clear"],
        when: hasApp,
        run: () => lifecycle.request("clearData"),
      },
      {
        id: "app.refresh",
        title: "Refresh the app's details and permissions",
        group: "App",
        icon: RefreshCw,
        screen: true,
        keywords: ["reload", "version", "permissions"],
        when: hasApp,
        run: refresh,
      },
      {
        id: "app.monitor.toggle",
        title: process.paused.value ? "Resume reading the app" : "Pause reading the app",
        group: "App",
        icon: process.paused.value ? Play : Pause,
        screen: true,
        keywords: ["perf", "memory", "cpu", "monitor"],
        when: hasApp,
        run: () => (process.paused.value ? process.resume() : process.pause()),
      },
      {
        id: "app.copy-package",
        title: "Copy the package name",
        group: "App",
        icon: Copy,
        screen: true,
        keywords: ["package", "id", "bundle"],
        when: hasApp,
        run: copyPackage,
      },
      {
        id: "app.show-in-apps",
        title: "Show in the phone's app list",
        group: "App",
        icon: LayoutList,
        screen: true,
        keywords: ["apps", "uninstall", "device"],
        when: hasApp,
        run: () => router.push({ name: "devices-apps", query: { package: app.packageName.value } }),
      },
    ];
  });
}
