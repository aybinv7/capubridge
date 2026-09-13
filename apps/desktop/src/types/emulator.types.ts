export interface RunningEmulator {
  serial: string | null;
  pid: number;
}

export interface AndroidVirtualDevice {
  name: string;
  running: RunningEmulator | null;
}

export interface EmulatorLaunchResult {
  avdName: string;
  logPath: string;
  alreadyRunning: boolean;
  serial: string | null;
}

export interface EmulatorStopResult {
  avdName: string;
  serial: string | null;
  pid: number;
}
