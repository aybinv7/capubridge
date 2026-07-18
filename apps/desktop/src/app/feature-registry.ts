import type { Component } from "vue";
import type { RouteRecordRaw } from "vue-router";
import {
  AppWindow,
  Bot,
  Crosshair,
  Database,
  FlaskConical,
  Globe,
  MonitorPlay,
  Settings,
  Smartphone,
  Zap,
} from "lucide-vue-next";
import { appRoutes } from "../modules/app/public";
import { browserPreviewRoutes } from "../modules/browser-preview/public";
import { deviceRoutes } from "../modules/devices/public";
import { inspectRoutes } from "../modules/inspect/public";
import { networkRoutes } from "../modules/network/public";
import { recordingRoutes } from "../modules/recording/public";
import { settingsRoutes } from "../modules/settings/public";
import { storageRoutes } from "../modules/storage/public";

export type FeatureMaturity = "stable" | "beta" | "experimental" | "hidden";
export type FeaturePlacement = "primary" | "utility" | "none";

export interface AppFeatureDefinition {
  id: string;
  label: string;
  path: string;
  icon: Component;
  maturity: FeatureMaturity;
  placement: FeaturePlacement;
  commandPalette: boolean;
  routes: readonly RouteRecordRaw[];
}

export const featureRegistry = [
  {
    id: "devices",
    label: "Devices",
    path: "/devices",
    icon: Smartphone,
    maturity: "stable",
    placement: "primary",
    commandPalette: true,
    routes: deviceRoutes,
  },
  {
    id: "app",
    label: "App",
    path: "/app",
    icon: AppWindow,
    maturity: "beta",
    placement: "primary",
    commandPalette: true,
    routes: appRoutes,
  },
  {
    id: "storage",
    label: "Storage",
    path: "/storage",
    icon: Database,
    maturity: "beta",
    placement: "primary",
    commandPalette: true,
    routes: storageRoutes,
  },
  {
    id: "network",
    label: "Network",
    path: "/network",
    icon: Globe,
    maturity: "beta",
    placement: "primary",
    commandPalette: true,
    routes: networkRoutes,
  },
  {
    id: "inspect",
    label: "Inspect",
    path: "/inspect",
    icon: Crosshair,
    maturity: "beta",
    placement: "primary",
    commandPalette: true,
    routes: inspectRoutes,
  },
  {
    id: "replay",
    label: "Replay",
    path: "/replay",
    icon: MonitorPlay,
    maturity: "beta",
    placement: "primary",
    commandPalette: true,
    routes: recordingRoutes,
  },
  {
    id: "preview",
    label: "Preview",
    path: "/preview",
    icon: FlaskConical,
    maturity: "experimental",
    placement: "none",
    commandPalette: true,
    routes: browserPreviewRoutes,
  },
  {
    id: "settings",
    label: "Settings",
    path: "/settings",
    icon: Settings,
    maturity: "stable",
    placement: "utility",
    commandPalette: true,
    routes: settingsRoutes,
  },
  {
    id: "capacitor",
    label: "Capacitor",
    path: "/capacitor",
    icon: Zap,
    maturity: "hidden",
    placement: "none",
    commandPalette: false,
    routes: [],
  },
  {
    id: "hybrid",
    label: "Hybrid",
    path: "/hybrid",
    icon: AppWindow,
    maturity: "hidden",
    placement: "none",
    commandPalette: false,
    routes: [],
  },
  {
    id: "assistant",
    label: "Assistant",
    path: "/assistant",
    icon: Bot,
    maturity: "hidden",
    placement: "none",
    commandPalette: false,
    routes: [],
  },
] as const satisfies readonly AppFeatureDefinition[];

export const experimentalFeaturesEnabled =
  import.meta.env.VITE_ENABLE_EXPERIMENTAL_FEATURES === "true";

export function isFeatureEnabled(
  feature: AppFeatureDefinition,
  allowExperimental = experimentalFeaturesEnabled,
) {
  return (
    feature.maturity === "stable" ||
    feature.maturity === "beta" ||
    (feature.maturity === "experimental" && allowExperimental)
  );
}

export const enabledFeatures = featureRegistry.filter((feature) => isFeatureEnabled(feature));

export const primaryNavigationFeatures = enabledFeatures.filter(
  (feature) => feature.placement === "primary",
);

export const utilityNavigationFeatures = enabledFeatures.filter(
  (feature) => feature.placement === "utility",
);

export const commandPaletteFeatures = enabledFeatures.filter((feature) => feature.commandPalette);

export const registeredFeatureRoutes = enabledFeatures.flatMap((feature) => [...feature.routes]);
