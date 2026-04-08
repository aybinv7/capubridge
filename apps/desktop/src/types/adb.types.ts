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
  androidVersion?: string;
  apiLevel?: number;
  battery?: number;
}

export interface AdbPackage {
  packageName: string;
  apkPath: string;
}

export interface ADBPackage {
  packageName: string;
  versionName: string;
  versionCode: number;
  apkPath: string;
  installTime: Date;
  dataDir: string;
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
  path: string;
  isDirectory: boolean;
  size: number;
  permissions: string;
  modifiedAt: string;
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
