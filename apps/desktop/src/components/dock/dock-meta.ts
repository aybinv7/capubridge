import type { Component } from "vue";
import { AlertTriangle, FileText, MessageSquare, Terminal } from "lucide-vue-next";
import type { DockTab } from "@/types/dock.types";

export const dockTabMeta: Record<DockTab, { label: string; windowTitle: string; icon: Component }> =
  {
    assistant: {
      label: "Assistant",
      windowTitle: "Assistant",
      icon: MessageSquare,
    },
    logcat: {
      label: "Logcat",
      windowTitle: "Logcat",
      icon: FileText,
    },
    repl: {
      label: "REPL",
      windowTitle: "REPL",
      icon: Terminal,
    },
    console: {
      label: "Console",
      windowTitle: "Console",
      icon: FileText,
    },
    exceptions: {
      label: "Exceptions",
      windowTitle: "Exceptions",
      icon: AlertTriangle,
    },
  };
