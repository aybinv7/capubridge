import type { Component } from "vue";
import {
  Cable,
  Cpu,
  Monitor,
  Plug,
  RefreshCw,
  RotateCw,
  ScanSearch,
  Smartphone,
  SquareArrowUpRight,
  Wifi,
} from "lucide-vue-next";
import type { GateActionId } from "@/lib/gates/types";

export interface GateActionMeta {
  label: string;
  icon: Component;
  binding?: string;
}

/** Presentation of every gate action; behaviour lives in `useGateActions`. */
export const GATE_ACTIONS: Record<GateActionId, GateActionMeta> = {
  "choose-target": { label: "Choose target", icon: Cable, binding: "mod+shift+d" },
  "choose-device": { label: "Choose device", icon: Smartphone, binding: "mod+shift+d" },
  "pair-wifi": { label: "Pair over Wi-Fi", icon: Wifi },
  "start-emulator": { label: "Start an emulator", icon: Cpu },
  "open-local-url": { label: "Inspect a URL on This PC", icon: Monitor },
  "start-adb": { label: "Start ADB", icon: Plug },
  "rescan-devices": { label: "Rescan devices", icon: RefreshCw },
  "scan-targets": { label: "Scan targets", icon: ScanSearch },
  connect: { label: "Attach", icon: Plug },
  reconnect: { label: "Reconnect", icon: RotateCw },
  "bring-to-front": { label: "Bring app to front", icon: SquareArrowUpRight },
};
