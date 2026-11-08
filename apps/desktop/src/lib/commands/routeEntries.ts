import type { RouteRecordRaw } from "vue-router";
import type { GateRequirement } from "@/lib/gates/types";

/** The part of a feature the palette reads; the feature registry's definitions fit it. */
export interface RouteSource {
  id: string;
  label: string;
  path: string;
  routes: readonly RouteRecordRaw[];
}

/** One child route offered as a destination, "Data › SQLite". */
export interface RouteEntry {
  id: string;
  featureId: string;
  featureLabel: string;
  label: string;
  title: string;
  path: string;
  requires: GateRequirement;
  keywords: readonly string[];
}

export const ROUTE_TITLE_SEPARATOR = " › ";

function formatName(name: string): string {
  return name
    .split("-")
    .slice(1)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function joinPath(parent: string, segment: string): string {
  const base = parent.replace(/\/$/, "");
  return segment ? `${base}/${segment}` : base;
}

function labelOf(route: RouteRecordRaw): string {
  const label = route.meta?.label;
  if (typeof label === "string" && label.trim()) return label.trim();
  return typeof route.name === "string" ? formatName(route.name) : "";
}

function extraKeywords(route: RouteRecordRaw): readonly string[] {
  const keywords = route.meta?.keywords;
  return Array.isArray(keywords) ? keywords.filter((word) => typeof word === "string") : [];
}

function isDestination(route: RouteRecordRaw): boolean {
  if (route.meta?.navigation === false) return false;
  if (!route.name || !route.path) return false;
  if (route.path.startsWith(":")) return false;
  return Boolean(route.component) || Boolean(route.children?.length);
}

function collect(
  source: RouteSource,
  routes: readonly RouteRecordRaw[],
  parentPath: string,
  isEnabled: (route: RouteRecordRaw) => boolean,
  into: RouteEntry[],
): void {
  for (const route of routes) {
    if (!isEnabled(route)) continue;
    const segment = route.path.replace(/^\//, "").split("/")[0] ?? "";
    const path = joinPath(parentPath, segment);
    if (route.children?.length) collect(source, route.children, path, isEnabled, into);
    if (!isDestination(route)) continue;
    const label = labelOf(route);
    if (!label) continue;
    into.push({
      id: `route.${String(route.name)}`,
      featureId: source.id,
      featureLabel: source.label,
      label,
      title: `${source.label}${ROUTE_TITLE_SEPARATOR}${label}`,
      path,
      requires: route.meta?.requires ?? "none",
      keywords: [source.label, label, ...extraKeywords(route)],
    });
  }
}

/**
 * Every child route of the given features as a destination, read from the routes themselves.
 * A feature's own top-level route is not an entry (the feature is); routes with
 * `navigation: false`, dynamic-only children, redirects and routes `isEnabled` refuses (hidden
 * or experimental-off) are left out. The label is `meta.label`, else the route name.
 */
export function deriveRouteEntries(
  features: readonly RouteSource[],
  isEnabled: (route: RouteRecordRaw) => boolean,
): RouteEntry[] {
  const entries: RouteEntry[] = [];
  for (const feature of features) {
    for (const route of feature.routes) {
      if (!isEnabled(route) || !route.children?.length) continue;
      const base = route.path.startsWith("/") ? route.path : `/${route.path}`;
      collect(feature, route.children, base, isEnabled, entries);
    }
  }
  return entries;
}
