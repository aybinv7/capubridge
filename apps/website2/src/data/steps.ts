export interface Step {
  index: string;
  title: string;
  description: string;
  detail: string;
  accent: string;
}

export const steps: Step[] = [
  {
    index: "01",
    title: "Plug in the device",
    description:
      "USB or Wi-Fi. Capubridge watches ADB and picks up the device as soon as it appears, with its own session per device.",
    detail: "USB · TCP/IP · pair · restart server",
    accent: "#e8765a",
  },
  {
    index: "02",
    title: "Pick a WebView target",
    description:
      "Every debuggable target on the device is listed with its origin. The CDP port is forwarded for you, so there is no port to guess.",
    detail: "Auto-forward · multi-target · no conflicts",
    accent: "#71cbff",
  },
  {
    index: "03",
    title: "Inspect without leaving",
    description:
      "Storage, DOM, network, logcat, performance and a live mirror of the phone stay in one window while the bug is still on screen.",
    detail: "Storage · DOM · logs · mirror · recording",
    accent: "#5ad39a",
  },
];
