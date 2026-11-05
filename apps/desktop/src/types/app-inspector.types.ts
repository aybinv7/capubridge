export interface AppPermission {
  name: string;
  shortName: string;
  granted: boolean;
  flags: string;
  isDangerous: boolean;
}

export interface AppPermissionsData {
  requested: string[];
  /** Permissions Android granted when the app was installed. */
  installGranted: string[];
  runtime: AppPermission[];
}

export interface AppNetworkStats {
  uid: number | null;
  wifiRxBytes: number;
  wifiTxBytes: number;
  mobileRxBytes: number;
  mobileTxBytes: number;
  available: boolean;
}

/** What Android counted for the app since the last full charge, from its uid's block. */
export interface AppBatteryStats {
  /** Processor time in the app's own code. */
  cpuUserMs: number;
  /** Processor time the kernel spent for it. */
  cpuSystemMs: number;
  /** Time the app was the one on screen. */
  onScreenMs: number;
  /** Time it held a partial wake lock, keeping the phone awake with the screen off. */
  wakePartialMs: number;
  /** Time it held a full wake lock, keeping the screen on. */
  wakeFullMs: number;
  /** Whether the phone printed a block for the app's uid at all. */
  hasData: boolean;
  /** The app's block as the phone printed it. */
  raw: string;
}

export interface AppCapacitorInfo {
  isCapacitor: boolean;
  bridgeActivity: string | null;
  plugins: string[];
  version: string | null;
}
