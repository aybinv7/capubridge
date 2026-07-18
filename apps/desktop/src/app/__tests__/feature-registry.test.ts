import { expect, test } from "vite-plus/test";
import {
  commandPaletteFeatures,
  enabledFeatures,
  featureRegistry,
  isFeatureEnabled,
  primaryNavigationFeatures,
  registeredFeatureRoutes,
  utilityNavigationFeatures,
} from "../feature-registry";

test("hidden features have no production exposure", () => {
  const hiddenFeatures = featureRegistry.filter((feature) => feature.maturity === "hidden");
  const exposedFeatureIds = new Set<string>(
    [
      ...enabledFeatures,
      ...primaryNavigationFeatures,
      ...utilityNavigationFeatures,
      ...commandPaletteFeatures,
    ].map((feature) => feature.id),
  );

  for (const feature of hiddenFeatures) {
    expect(feature.routes).toHaveLength(0);
    expect(exposedFeatureIds.has(feature.id)).toBe(false);
  }
});

test("registered routes exclude unfinished surfaces", () => {
  const serializedRoutes = JSON.stringify(registeredFeatureRoutes);

  expect(serializedRoutes).not.toContain("/capacitor");
  expect(serializedRoutes).not.toContain("/hybrid");
  expect(serializedRoutes).not.toContain("websocket");
  expect(serializedRoutes).not.toContain("throttle");
});

test("enabled features own unique entry routes", () => {
  const paths = enabledFeatures.map((feature) => feature.path);

  expect(new Set(paths).size).toBe(paths.length);
  expect(registeredFeatureRoutes.map((route) => route.path)).toEqual(paths);
});

test("experimental features require explicit opt in", () => {
  const experimentalFeature = featureRegistry.find(
    (feature) => feature.maturity === "experimental",
  );

  expect(experimentalFeature).toBeDefined();

  if (!experimentalFeature) {
    throw new Error("Expected an experimental feature fixture");
  }

  expect(isFeatureEnabled(experimentalFeature, false)).toBe(false);
  expect(isFeatureEnabled(experimentalFeature, true)).toBe(true);
});
