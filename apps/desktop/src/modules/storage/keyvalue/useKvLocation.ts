import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import type { KvSource } from "./kvModel";
import { queryOf, type KvLocationQuery } from "./kvSources";

export const KEYVALUE_ROUTE = "storage-keyvalue";

function param(value: unknown): string {
  if (Array.isArray(value)) return typeof value[0] === "string" ? value[0] : "";
  return typeof value === "string" ? value : "";
}

/** The list the Key-value tab shows, kept in the route query so links and Back work. */
export function useKvLocation() {
  const route = useRoute();
  const router = useRouter();

  const query = computed<KvLocationQuery>(() => ({
    origin: param(route.query["origin"]),
    source: param(route.query["source"]),
    database: param(route.query["db"]),
    store: param(route.query["store"]),
  }));

  function matches(source: KvSource): boolean {
    const next = queryOf(source);
    return Object.entries(next).every(([key, value]) => param(route.query[key]) === value);
  }

  function open(source: KvSource) {
    if (!matches(source)) void router.push({ name: KEYVALUE_ROUTE, query: queryOf(source) });
  }

  /** Writes the defaults the tab resolved into the address, without a history entry. */
  function settle(source: KvSource) {
    if (!matches(source)) void router.replace({ name: KEYVALUE_ROUTE, query: queryOf(source) });
  }

  return { query, open, settle };
}
