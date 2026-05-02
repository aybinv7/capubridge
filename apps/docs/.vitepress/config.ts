import { defineConfig } from "vitepress";
import { icons } from "./sidebar-icons";

export default defineConfig({
  title: "Capubridge",
  description:
    "Developer tools for WebView-based Android apps — ADB management, storage inspection, CDP debugging, and more.",
  lang: "en-US",

  head: [
    ["link", { rel: "icon", type: "image/svg+xml", href: "/icon.png" }],
    ["meta", { name: "theme-color", content: "#0e0e10" }],
    ["meta", { name: "og:site_name", content: "Capubridge" }],
    ["meta", { name: "twitter:card", content: "summary_large_image" }],
  ],

  cleanUrls: true,
  lastUpdated: true,

  markdown: {
    theme: {
      dark: "github-dark-dimmed",
      light: "github-light",
    },
    lineNumbers: false,
    container: {
      tipLabel: "TIP",
      warningLabel: "WARNING",
      dangerLabel: "DANGER",
      infoLabel: "INFO",
      detailsLabel: "Details",
    },
  },

  themeConfig: {
    logo: "/capubridge.svg",
    siteTitle: "Capubridge",

    nav: [
      { text: "Guide", link: "/guide/", activeMatch: "/guide/" },
      { text: "Modules", link: "/modules/", activeMatch: "/modules/" },
      {
        text: "Architecture",
        link: "/architecture/",
        activeMatch: "/architecture/",
      },
      { text: "Runtime", link: "/runtime/", activeMatch: "/runtime/" },
      {
        text: "Reference",
        items: [
          { text: "CLI Commands", link: "/reference/cli" },
          { text: "IPC Contract", link: "/reference/ipc" },
          { text: "Session Events", link: "/reference/events" },
        ],
      },
      { text: "GitHub", link: "https://github.com/aybinv7/capubridge" },
    ],

    sidebar: {
      "/guide/": [
        {
          text: "Getting Started",
          items: [
            { text: "Introduction", link: "/guide/" },
            { text: "Installation", link: "/guide/installation" },
            { text: "Quick Start", link: "/guide/quick-start" },
          ],
        },
        {
          text: "Core Concepts",
          items: [
            { text: "Device Sessions", link: "/guide/concepts/devices" },
            { text: "Targets & CDP", link: "/guide/concepts/targets" },
            { text: "Storage Context", link: "/guide/concepts/storage" },
          ],
        },
        {
          text: "Configuration",
          items: [
            { text: "ADB Settings", link: "/guide/config/adb" },
            { text: "Theme", link: "/guide/config/theme" },
            { text: "Shortcuts", link: "/guide/config/shortcuts" },
          ],
        },
      ],
      "/modules/": [
        {
          text: "Device Manager",
          items: [{ text: "Overview", link: "/modules/devices" }],
        },
        {
          text: "Modules",
          items: [
            { text: `${icons.devices}Devices`, link: "/modules/devices" },
            { text: `${icons.app}App Inspector`, link: "/modules/app" },
            { text: `${icons.storage}Storage`, link: "/modules/storage" },
            { text: `${icons.network}Network`, link: "/modules/network" },
            { text: `${icons.inspect}DOM Inspector`, link: "/modules/inspect" },
            { text: `${icons.capacitor}Capacitor`, link: "/modules/capacitor" },
            { text: `${icons.recording}Recording & Replay`, link: "/modules/recording" },
            { text: `${icons.hybrid}Hybrid Tools`, link: "/modules/hybrid" },
          ],
        },
        {
          text: "Dock",
          items: [
            { text: `${icons.dock}Bottom Dock`, link: "/modules/dock" },
            { text: `${icons.mirror}Screen Mirror`, link: "/modules/mirror" },
          ],
        },
        { text: `${icons.settings}Settings`, link: "/modules/settings" },
      ],
      "/architecture/": [
        {
          text: "System Design",
          items: [
            { text: "Overview", link: "/architecture/" },
            { text: "Data Flow", link: "/architecture/data-flow" },
          ],
        },
        {
          text: "Frontend",
          items: [
            { text: "Store Architecture", link: "/architecture/stores" },
            { text: "Composables", link: "/architecture/composables" },
          ],
        },
        {
          text: "Backend",
          items: [
            { text: "Session Runtime", link: "/architecture/session" },
            { text: "ADB Integration", link: "/architecture/adb" },
            { text: "CDP Transport", link: "/architecture/cdp" },
          ],
        },
      ],
      "/runtime/": [
        {
          text: "Runtime",
          items: [
            { text: "Overview", link: "/runtime/" },
            { text: "Effect Layer", link: "/runtime/effect" },
            { text: "Error Handling", link: "/runtime/errors" },
          ],
        },
      ],
      "/reference/": [
        {
          text: "API Reference",
          items: [
            { text: "CLI Commands", link: "/reference/cli" },
            { text: "IPC Contract", link: "/reference/ipc" },
            { text: "Session Events", link: "/reference/events" },
          ],
        },
        {
          text: "TypeScript",
          items: [
            { text: "Store Types", link: "/reference/types/stores" },
            { text: "CDP Types", link: "/reference/types/cdp" },
            { text: "Storage Types", link: "/reference/types/storage" },
          ],
        },
      ],
    },

    search: {
      provider: "local",
      options: {
        detailedView: true,
      },
    },

    editLink: {
      pattern: "https://github.com/aybinv7/capubridge/edit/main/apps/docs/:path",
      text: "Edit this page on GitHub",
    },

    footer: {
      message: "Released under the MIT License.",
      copyright: "Copyright © 2025-present Capubridge",
    },

    socialLinks: [{ icon: "github", link: "https://github.com/aybinv7/capubridge" }],
  },

  vite: {
    css: {
      preprocessorOptions: {},
    },
  },
});
