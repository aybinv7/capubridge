import type { Component } from "vue";
import type { RouteRecordRaw } from "vue-router";
import {
  AppWindow,
  Bot,
  Bug,
  Crosshair,
  Database,
  FlaskConical,
  Globe,
  MonitorPlay,
  Settings,
  Smartphone,
} from "lucide-vue-next";
import type { RailIconKey } from "@/shared/icons/shell-icons";
import { appRoutes } from "../modules/app/public";
import { browserPreviewRoutes } from "../modules/browser-preview/public";
import { deviceRoutes } from "../modules/devices/public";
import { devtoolsRoutes } from "../modules/devtools/public";
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
  /** The rail glyph (`shellIcons.rail`): filled while the destination is current, regular otherwise. */
  railIcon: RailIconKey;
  /** About an Android device or app, so it leaves the rail while This PC is the context. */
  deviceOnly?: boolean;
  maturity: FeatureMaturity;
  placement: FeaturePlacement;
  commandPalette: boolean;
  goKey?: string;
  routes: readonly RouteRecordRaw[];
}

export const featureRegistry = [
  {
    id: "devices",
    goKey: "d",
    label: "Device",
    path: "/devices",
    icon: Smartphone,
    railIcon: "device",
    deviceOnly: true,
    maturity: "stable",
    placement: "primary",
    commandPalette: true,
    routes: deviceRoutes,
  },
  {
    id: "app",
    goKey: "a",
    label: "App",
    path: "/app",
    icon: AppWindow,
    railIcon: "app",
    deviceOnly: true,
    maturity: "beta",
    placement: "primary",
    commandPalette: true,
    routes: appRoutes,
  },
  {
    id: "storage",
    goKey: "s",
    label: "Data",
    path: "/storage",
    icon: Database,
    railIcon: "data",
    maturity: "beta",
    placement: "primary",
    commandPalette: true,
    routes: storageRoutes,
  },
  {
    id: "network",
    goKey: "n",
    label: "Network",
    path: "/network",
    icon: Globe,
    railIcon: "network",
    maturity: "beta",
    placement: "primary",
    commandPalette: true,
    routes: networkRoutes,
  },
  {
    id: "inspect",
    goKey: "e",
    label: "Elements",
    path: "/inspect",
    icon: Crosshair,
    railIcon: "elements",
    maturity: "beta",
    placement: "primary",
    commandPalette: true,
    routes: inspectRoutes,
  },
  {
    id: "devtools",
    goKey: "t",
    label: "DevTools",
    path: "/devtools",
    icon: Bug,
    railIcon: "devtools",
    maturity: "beta",
    placement: "primary",
    commandPalette: true,
    routes: devtoolsRoutes,
  },
  {
    id: "replay",
    goKey: "r",
    label: "Replay",
    path: "/replay",
    icon: MonitorPlay,
    railIcon: "replay",
    maturity: "beta",
    placement: "primary",
    commandPalette: true,
    routes: recordingRoutes,
  },
  {
    id: "automation",
    goKey: "f",
    label: "Flows",
    path: "/automation",
    icon: Bot,
    railIcon: "flows",
    maturity: "hidden",
    placement: "primary",
    commandPalette: true,
    routes: [],
  },
  {
    id: "preview",
    label: "Preview",
    path: "/preview",
    icon: FlaskConical,
    railIcon: "preview",
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
    railIcon: "settings",
    maturity: "stable",
    placement: "utility",
    commandPalette: true,
    routes: settingsRoutes,
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

export function isRouteEnabled(
  route: RouteRecordRaw,
  allowExperimental = experimentalFeaturesEnabled,
) {
  return route.meta?.maturity !== "experimental" || allowExperimental;
}

function filterFeatureRoutes(
  routes: readonly RouteRecordRaw[],
  allowExperimental = experimentalFeaturesEnabled,
): RouteRecordRaw[] {
  const filteredRoutes: RouteRecordRaw[] = [];

  for (const route of routes) {
    if (!isRouteEnabled(route, allowExperimental)) continue;

    if (route.children) {
      filteredRoutes.push({
        ...route,
        children: filterFeatureRoutes(route.children, allowExperimental),
      });
      continue;
    }

    filteredRoutes.push(route);
  }

  return filteredRoutes;
}

export const enabledFeatures = featureRegistry.filter((feature) => isFeatureEnabled(feature));

export const primaryNavigationFeatures = enabledFeatures.filter(
  (feature) => feature.placement === "primary",
);

export const utilityNavigationFeatures = enabledFeatures.filter(
  (feature) => feature.placement === "utility",
);

export const commandPaletteFeatures = enabledFeatures.filter((feature) => feature.commandPalette);

/** Whether `feature` belongs in the rail for the current context. */
export function showsInContext(feature: AppFeatureDefinition, thisPc: boolean): boolean {
  return !(thisPc && feature.deviceOnly);
}

/** Paths of the destinations about an Android device, which This PC has no use for. */
export const deviceOnlyPaths: readonly string[] = enabledFeatures
  .filter((feature: AppFeatureDefinition) => feature.deviceOnly)
  .map((feature) => feature.path);

export const registeredFeatureRoutes = enabledFeatures.flatMap((feature) =>
  filterFeatureRoutes(feature.routes),
);
