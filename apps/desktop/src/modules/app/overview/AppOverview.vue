<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { Button, Spinner } from "@capubridge/cladd";
import FactList from "@/shared/facts/FactList.vue";
import { useAppSession } from "../appSession";
import { useWebViewRuntime } from "../runtime/useWebViewRuntime";
import AppActions from "./AppActions.vue";
import AppHeader from "./AppHeader.vue";
import AppStorage from "./AppStorage.vue";
import AppVitals from "./AppVitals.vue";
import { appFacts, versionWords } from "./appFacts";
import AppPermissions from "./permissions/AppPermissions.vue";

const router = useRouter();
const { app, process, phase, dump, lifecycle } = useAppSession();
const { details, entry, name, packageName, serial, target } = app;
const { busy, inBackground } = lifecycle;
const runtime = useWebViewRuntime(app.presence);

const apkPath = computed(() => entry.value?.apkPath ?? details.data.value?.apkPath ?? "");
const version = computed(() => versionWords(details.data.value));
const facts = computed(() =>
  appFacts({
    packageName: packageName.value,
    details: details.data.value,
    pageUrl: target.value?.url ?? null,
    pageTitle: target.value?.title ?? null,
    runtime: runtime.data.value,
    capacitor: dump.capacitor.value,
    pid: process.latest.value?.pid ?? null,
    running: phase.running.value,
  }),
);

function refresh() {
  void Promise.all([details.refetch(), dump.query.refetch(), runtime.refetch()]);
}

function showInApps() {
  void router.push({ name: "devices-apps", query: { package: packageName.value } });
}
</script>

<template>
  <div class="h-full overflow-y-auto">
    <div class="mx-auto flex max-w-4xl flex-col gap-7 px-8 py-7">
      <div class="flex flex-col gap-4">
        <AppHeader
          :serial="serial"
          :package-name="packageName"
          :name="name"
          :entry="entry"
          :apk-path="apkPath"
          :run-label="phase.run.value.label"
          :run-mark="phase.run.value.mark"
          :version="version"
          :refreshing="details.isFetching.value || dump.query.isFetching.value"
          @refresh="refresh"
          @show-in-apps="showInApps"
        />
        <AppActions
          :busy="busy"
          :in-background="inBackground"
          @open="lifecycle.open()"
          @restart="lifecycle.restart()"
          @force-stop="lifecycle.request('forceStop')"
          @clear-data="lifecycle.request('clearData')"
        />
      </div>

      <AppVitals />

      <div
        v-if="details.isPending.value"
        class="flex items-center gap-2 text-xs text-muted-foreground"
      >
        <Spinner size="xs" />
        Reading the app's details
      </div>
      <div
        v-else-if="details.isError.value"
        class="flex items-start gap-3 rounded-control bg-surface-cut px-3 py-2.5 shadow-cut"
        role="alert"
      >
        <div class="flex min-w-0 flex-1 flex-col gap-0.5">
          <p class="text-xs text-foreground">The phone did not send this app's details.</p>
          <p class="font-mono text-2xs break-all text-error">{{ details.error.value }}</p>
        </div>
        <Button size="sm" variant="transparent" @click="details.refetch()">Try again</Button>
      </div>
      <FactList title="About this app" :facts="facts" />

      <AppStorage :package-name="packageName" :entry="entry" :details="details.data.value" />

      <AppPermissions />
    </div>
  </div>
</template>
