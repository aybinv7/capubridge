import type { ComputedRef } from "vue";
import { Copy, FileCode2, Link, Replace, RotateCw, Terminal } from "lucide-vue-next";
import { useCommandProvider } from "@/composables/useCommandProvider";
import type { NetworkEntry } from "@/types/network.types";
import { mockAvailability } from "../mock/mockFromRequest";
import { hasResponseBody } from "./details/useRequestBodies";
import type { RequestActions } from "./details/useRequestActions";

interface RequestsCommandsInput {
  selected: ComputedRef<NetworkEntry | null>;
  actions: RequestActions;
  reload: () => Promise<void>;
}

/** Palette commands for the selected request and the page, while Requests is open. */
export function useRequestsCommands({ selected, actions, reload }: RequestsCommandsInput) {
  useCommandProvider("screen.network-requests", () => {
    const entry = selected.value;
    return [
      {
        id: "network.reload-page",
        title: "Reload the page",
        group: "Network",
        icon: RotateCw,
        screen: true,
        keywords: ["refresh", "capture", "start"],
        run: reload,
      },
      {
        id: "network.copy-address",
        title: "Copy request address",
        group: "Network",
        icon: Link,
        screen: true,
        keywords: ["url", "link"],
        when: () => entry !== null,
        run: () => (entry ? actions.copy(entry, "url") : undefined),
      },
      {
        id: "network.copy-curl",
        title: "Copy request as cURL",
        group: "Network",
        icon: Terminal,
        screen: true,
        keywords: ["curl", "shell", "command"],
        when: () => entry !== null,
        run: () => (entry ? actions.copy(entry, "curl") : undefined),
      },
      {
        id: "network.copy-fetch",
        title: "Copy request as fetch",
        group: "Network",
        icon: FileCode2,
        screen: true,
        keywords: ["javascript", "code"],
        when: () => entry !== null,
        run: () => (entry ? actions.copy(entry, "fetch") : undefined),
      },
      {
        id: "network.copy-response",
        title: "Copy response",
        group: "Network",
        icon: Copy,
        screen: true,
        keywords: ["body"],
        when: () => entry !== null && hasResponseBody(entry),
        run: () => (entry ? actions.copy(entry, "response") : undefined),
      },
      {
        id: "network.copy-response-base64",
        title: "Copy response as Base64",
        group: "Network",
        icon: Copy,
        screen: true,
        keywords: ["body", "binary", "bytes"],
        when: () => entry !== null && hasResponseBody(entry),
        run: () => (entry ? actions.copy(entry, "base64") : undefined),
      },
      {
        id: "network.mock-response",
        title: "Mock this response",
        group: "Network",
        icon: Replace,
        screen: true,
        keywords: ["fake", "stub", "rule", "override"],
        when: () => actions.canMock && entry !== null && mockAvailability(entry).ok,
        run: () => (entry ? actions.mockResponse(entry) : undefined),
      },
    ];
  });
}
