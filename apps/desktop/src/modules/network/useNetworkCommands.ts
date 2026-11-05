import { nextTick } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Pause, Pin, Play, Search, Trash2 } from "lucide-vue-next";
import { useCommandProvider } from "@/composables/useCommandProvider";
import { useNetworkStore } from "./stores/useNetworkStore";

/** Palette commands of the Network route, available on both of its tabs. */
export function useNetworkCommands() {
  const store = useNetworkStore();
  const route = useRoute();
  const router = useRouter();

  async function filterRequests() {
    if (route.name === "network-requests") {
      store.triggerFocusSearch();
      return;
    }
    await router.push({ name: "network-requests", query: { focus: "filter" } });
    await nextTick();
  }

  useCommandProvider("screen.network", () => [
    {
      id: "network.toggle-capture",
      title: store.isRecording ? "Pause capture" : "Resume capture",
      group: "Network",
      icon: store.isRecording ? Pause : Play,
      screen: true,
      keywords: ["record", "capture", "requests"],
      run: () => {
        store.isRecording = !store.isRecording;
      },
    },
    {
      id: "network.clear",
      title: "Clear requests",
      group: "Network",
      icon: Trash2,
      screen: true,
      keywords: ["reset", "empty"],
      when: () => store.requestCount > 0,
      run: () => store.clear(),
    },
    {
      id: "network.preserve",
      title: store.preserveLog
        ? "Stop keeping requests across reloads"
        : "Keep requests across reloads",
      group: "Network",
      icon: Pin,
      screen: true,
      keywords: ["preserve", "log", "navigation"],
      run: () => {
        store.preserveLog = !store.preserveLog;
      },
    },
    {
      id: "network.filter",
      title: "Filter requests",
      group: "Network",
      icon: Search,
      screen: true,
      keywords: ["search", "find"],
      run: filterRequests,
    },
  ]);
}
