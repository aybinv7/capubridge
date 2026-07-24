import { invokeCommand } from "@/runtime/ipc/client";
import type { AndroidVirtualDevice, EmulatorLaunchResult } from "@/types/emulator.types";

export function useEmulators() {
  async function listAvds(): Promise<AndroidVirtualDevice[]> {
    return await invokeCommand("emulator_list_avds");
  }

  async function launchAvd(avdName: string): Promise<EmulatorLaunchResult> {
    return await invokeCommand("emulator_launch_avd", { avdName });
  }

  return { listAvds, launchAvd };
}
