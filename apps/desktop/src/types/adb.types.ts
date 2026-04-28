export interface WebViewSocket {
  socketName: string;
  pid: number | null;
  packageName: string | null;
}

export interface ADBDevice {
  serial: string;
  model: string;
  product: string;
  transportId: string;
  connectionType: "usb" | "wifi";
  status: "online" | "offline" | "unauthorized" | "no-permissions";
  isStale?: boolean;
  lastSeenAt?: number | null;
  lastUpdatedAt?: number | null;
  androidVersion?: string;
  apiLevel?: number;
  battery?: number;
}

export interface AdbPackage {
  packageName: string;
  apkPath: string;
  system: boolean;
  enabled: boolean;
  label?: string | null;
  iconPath?: string | null;
  isStale?: boolean;
  lastUpdatedAt?: number | null;
}

export interface AdbPackageDetails {
  packageName: string;
  apkPath?: string | null;
  versionName?: string | null;
  versionCode?: string | null;
  firstInstallTime?: string | null;
  lastUpdateTime?: string | null;
  minSdkVersion?: number | null;
  targetSdkVersion?: number | null;
  installerPackageName?: string | null;
  dataDir?: string | null;
  externalDataDir?: string | null;
  mediaDir?: string | null;
  obbDir?: string | null;
  appSize?: number | null;
  dataSize?: number | null;
  cacheSize?: number | null;
  launchableActivity?: string | null;
}

export interface ReverseRule {
  remotePort: number;
  localPort: number;
}

export interface ADBPackage {
  packageName: string;
  apkPath: string;
  system: boolean;
  enabled: boolean;
  label?: string | null;
  iconPath?: string | null;
  versionName?: string | null;
  versionCode?: string | null;
  firstInstallTime?: string | null;
  lastUpdateTime?: string | null;
  minSdkVersion?: number | null;
  targetSdkVersion?: number | null;
  dataDir?: string | null;
  sizeBytes?: number;
}

export interface LogcatEntry {
  id: string;
  timestamp: Date;
  pid: number;
  tid: number;
  level: "V" | "D" | "I" | "W" | "E" | "F";
  tag: string;
  message: string;
}

export interface FileEntry {
  name: string;
  size: number;
  modified: string; // "YYYY-MM-DD HH:MM" or "Mon DD HH:MM"
  entryType: "file" | "dir" | "symlink" | "other";
  permissions: string; // 9-char unix perm string e.g. "rwxr-xr-x"
}

export interface DeviceFileContent {
  base64: string;
  size: number;
}

export interface DeviceInfo {
  serial: string;
  model: string;
  manufacturer: string;
  androidVersion: string;
  apiLevel: number;
  screenResolution: string;
  screenDpi: number;
  cpuArch: string;
  totalRam: number;
  availableRam: number;
  totalStorage: number;
  availableStorage: number;
  batteryLevel: number;
  batteryCharging: boolean;
  ipAddresses: string[];
}
