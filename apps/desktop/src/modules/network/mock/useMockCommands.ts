import { CircleSlash, Plus, Server, Upload, Zap } from "lucide-vue-next";
import { useCommandProvider } from "@/composables/useCommandProvider";
import type { MockInterceptMode, MockRule } from "@/types/mock.types";
import { useMockStore } from "../stores/useMockStore";

interface MockCommandsInput {
  create: (template?: Partial<MockRule>) => void;
  importRule: () => Promise<void>;
}

const MODE_COMMANDS: ReadonlyArray<{ mode: MockInterceptMode; title: string; icon: typeof Zap }> = [
  { mode: "off", title: "Turn interception off", icon: CircleSlash },
  { mode: "cdp", title: "Intercept in the WebView", icon: Zap },
  { mode: "http", title: "Run the local mock server", icon: Server },
];

/** Palette commands for Mocking: new and imported rules, and the interception mode. */
export function useMockCommands({ create, importRule }: MockCommandsInput) {
  const store = useMockStore();

  useCommandProvider("screen.network-mock", () => [
    {
      id: "network.mock-new-rule",
      title: "New mock rule",
      group: "Network",
      icon: Plus,
      screen: true,
      keywords: ["mock", "stub", "fake", "create"],
      run: () => create(),
    },
    {
      id: "network.mock-import",
      title: "Import a mock rule",
      group: "Network",
      icon: Upload,
      screen: true,
      keywords: ["mock", "file", "load"],
      run: importRule,
    },
    ...MODE_COMMANDS.map((command) => ({
      id: `network.mock-mode-${command.mode}`,
      title: command.title,
      group: "Network" as const,
      icon: command.icon,
      screen: true,
      keywords: ["mock", "interception", "mode"],
      when: () => store.interceptMode !== command.mode,
      run: () => {
        store.interceptMode = command.mode;
      },
    })),
  ]);
}
