export interface DeviceInfo {
  android: boolean;
  desktop: boolean;
  ios: boolean;
  ipad: boolean;
  iphone: boolean;
  ipod: boolean;
  mobile: boolean;
}

interface DeviceOverrides {
  userAgent?: string;
}

interface NwWindow {
  DocumentTouch?: unknown;
  nw?: unknown;
}

let deviceCalculated: DeviceInfo | null = null;

function calcDevice({ userAgent }: DeviceOverrides = {}): DeviceInfo | null {
  if (typeof window === "undefined") return null;
  const nwWindow = window as unknown as NwWindow;
  const supportTouch =
    "ontouchstart" in window ||
    Boolean(
      nwWindow.DocumentTouch && document instanceof (nwWindow.DocumentTouch as typeof Object),
    );
  const platform = window.navigator.platform;
  const ua = userAgent || window.navigator.userAgent;

  const device: DeviceInfo = {
    android: false,
    desktop: false,
    ios: false,
    ipad: false,
    iphone: false,
    ipod: false,
    mobile: false,
  };

  const android = ua.match(/(Android);?[\s/]+([\d.]+)?/);
  let ipad = ua.match(/(iPad).*OS\s([\d_]+)/);
  const ipod = ua.match(/(iPod)(.*OS\s([\d_]+))?/);
  const iphone = !ipad && ua.match(/(iPhone\sOS|iOS|iPhone;\sCPU\sOS)\s([\d_]+)/);

  const electron = ua.toLowerCase().indexOf("electron") >= 0;
  const nwjs = typeof nwWindow.nw !== "undefined";
  let macos = platform === "MacIntel";

  if (!ipad && macos && supportTouch) {
    ipad = ua.match(/(Version)\/([\d.]+)/);
    if (!ipad) ipad = ["", "Version", "13_0_0"] as unknown as RegExpMatchArray;
    macos = false;
  }

  if (android) device.android = true;
  if (ipad || iphone || ipod) device.ios = true;
  if (iphone && !ipod) device.iphone = true;
  if (ipad) device.ipad = true;
  if (ipod) device.ipod = true;

  device.desktop = !(device.ios || device.android) || electron || nwjs;
  device.mobile = device.ios || device.android;

  return device;
}

export function useDevice(overrides: DeviceOverrides = {}, reset?: boolean): DeviceInfo {
  if (!deviceCalculated || reset) {
    const result = calcDevice(overrides);
    if (result) deviceCalculated = result;
  }
  return deviceCalculated ?? ({} as DeviceInfo);
}
