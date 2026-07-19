import type { IpcCommand } from "@/runtime/ipc/contracts/common";
import type { UpdateInfo } from "@/types/updater.types";

export interface UpdaterCommandMap {
  updater_check: IpcCommand<{ prerelease: boolean }, UpdateInfo | null>;
  updater_install: IpcCommand<undefined, void>;
}
