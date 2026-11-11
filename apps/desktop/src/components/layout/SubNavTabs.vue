<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Tab, Tabs, TabsList } from "@capubridge/cladd";
import { isRouteEnabled } from "@/app/feature-registry";

type SubTab = {
  name: string;
  label: string;
  path: string;
};

const route = useRoute();
const router = useRouter();

function formatLabel(name: string): string {
  return name
    .split("-")
    .slice(1)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

const subTabs = computed<SubTab[]>(() => {
  const parentRoute = route.matched[0];
  if (!parentRoute?.children) return [];

  const parentPath = parentRoute.path.replace(/\/$/, "");
  return parentRoute.children
    .filter(
      (child) =>
        child.path &&
        !child.path.startsWith(":") &&
        child.name &&
        child.meta?.navigation !== false &&
        isRouteEnabled(child),
    )
    .map((child) => {
      const childPath = child.path.replace(/^\//, "").split("/")[0];
      const name = String(child.name);
      return {
        name,
        label: typeof child.meta?.label === "string" ? child.meta.label : formatLabel(name),
        path: childPath ? `${parentPath}/${childPath}` : parentPath,
      };
    });
});

const activePath = computed(() => {
  const owner = route.meta.tabPath;
  if (typeof owner === "string") return owner;
  return subTabs.value.find(
    (tab) => route.path === tab.path || route.path.startsWith(`${tab.path}/`),
  )?.path;
});

function select(path: string) {
  if (path !== route.path) void router.push(path);
}
</script>

<template>
  <Tabs :value="activePath" @update:value="select">
    <TabsList
      aria-label="Sections"
      active-variant="solid"
      :rounded="false"
      class="shrink-0 flex-wrap justify-start gap-0.5 border-b border-border-subtle px-2.5 py-2"
    >
      <Tab
        v-for="tab in subTabs"
        :key="tab.name"
        :value="tab.path"
        class="text-sm font-normal text-muted-foreground data-active:font-medium data-active:text-foreground"
      >
        {{ tab.label }}
      </Tab>
    </TabsList>
  </Tabs>
</template>
