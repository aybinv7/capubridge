export interface AppMemInfo {
  pid: number | null;
  totalPssKb: number;
  nativeHeapKb: number;
  dalvikHeapKb: number;
  codeKb: number;
  stackKb: number;
  graphicsKb: number;
  otherKb: number;
  threadCount: number | null;
  isRunning: boolean;
}

export interface AppCpuInfo {
  totalPct: number;
  userPct: number;
  kernelPct: number;
}

export interface AppPermission {
  name: string;
  shortName: string;
  granted: boolean;
  flags: string;
  isDangerous: boolean;
}

export interface AppPermissionsData {
  requested: string[];
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

export interface AppBatteryStats {
  fgCpuTimeMs: number;
  bgCpuTimeMs: number;
  wakelocksMs: number;
  hasData: boolean;
  raw: string;
}

export interface AppCapacitorInfo {
  isCapacitor: boolean;
  bridgeActivity: string | null;
  plugins: string[];
  version: string | null;
}
