<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { useQuery } from "@tanstack/vue-query";
import { ArrowRight, ArrowUpRight, Play } from "lucide-vue-next";
import { Button, Surface } from "@capubridge/cladd";
import { toast } from "vue-sonner";
import { useAdb } from "@/composables/useAdb";
import { PACKAGE_CACHE_STALE_MS, useAppPackages } from "@/composables/useAppPackages";
import { targetAppName } from "@/lib/target-app-name";
import { useTargetPresenceStore } from "@/stores/targetPresence.store";
import { useTargetsStore } from "@/stores/targets.store";
import AppIcon from "@/shared/apps/AppIcon.vue";

const props = defineProps<{ serial: string }>();

const router = useRouter();
const targets = useTargetsStore();
const presence = useTargetPresenceStore();
const { getPackageDetails, openPackage } = useAdb();
const { getCachedPackage } = useAppPackages(computed(() => props.serial));
const launching = ref(false);

const packageName = computed(() => {
  const target = targets.selectedTarget;
  if (target?.source !== "adb" || !target.packageName) return null;
  if (target.deviceSerial && target.deviceSerial !== props.serial) return null;
  return target.packageName;
});
const cached = computed(() => (packageName.value ? getCachedPackage(packageName.value) : null));
const label = computed(
  () => targetAppName(targets.selectedTarget, cached.value?.label) ?? packageName.value ?? "",
);
const inBackground = computed(() => presence.presence === "background");

const { data: details } = useQuery({
  queryKey: computed(() => ["package-details", props.serial, packageName.value ?? ""]),
  queryFn: () => getPackageDetails(props.serial, packageName.value ?? ""),
  enabled: computed(() => Boolean(props.serial && packageName.value)),
  staleTime: PACKAGE_CACHE_STALE_MS,
});

const version = computed(() => {
  const name = details.value?.versionName;
  if (!name) return null;
  const code = details.value?.versionCode;
  return code ? `Version ${name} (${code})` : `Version ${name}`;
});

const subline = computed(() =>
  [version.value, inBackground.value ? "In the background" : null].filter(Boolean).join(" · "),
);

async function launch() {
  if (!packageName.value) return;
  launching.value = true;
  try {
    await openPackage(props.serial, packageName.value);
    if (inBackground.value) presence.probeNow();
    else toast.success(`${label.value} opened on the phone`);
  } catch (error) {
    toast.error(`Could not open ${label.value}`, { description: String(error) });
  } finally {
    launching.value = false;
  }
}

function showInApps() {
  if (!packageName.value) return;
  void router.push({ name: "devices-apps", query: { package: packageName.value } });
}
</script>

<template>
  <section v-if="packageName" class="flex flex-col gap-2" aria-labelledby="overview-app-title">
    <h2 id="overview-app-title" class="text-sm font-medium text-foreground">
      App you are inspecting
    </h2>
    <Surface
      variant="solid"
      level="+1"
      outline
      class="rounded-well"
      content-class-name="flex items-center gap-3 p-3"
    >
      <AppIcon
        :serial="props.serial"
        :package-name="packageName"
        :apk-path="cached?.apkPath ?? details?.apkPath ?? ''"
        :icon-path="cached?.iconPath ?? null"
        size="sm"
        class="!size-9 !rounded-inner"
      />
      <span class="flex min-w-0 flex-1 flex-col gap-0.5" :title="packageName">
        <span class="truncate text-sm font-medium text-foreground">{{ label }}</span>
        <span v-if="subline" class="truncate text-2xs text-muted-foreground">{{ subline }}</span>
      </span>
      <Button
        size="sm"
        variant="transparent"
        :loading="launching"
        content-class-name="gap-1.5 px-2.5 [&>svg]:size-3.5"
        @click="launch"
      >
        <ArrowUpRight v-if="inBackground" :stroke-width="1.8" />
        <Play v-else :stroke-width="1.8" />
        {{ inBackground ? "Bring to front" : "Open" }}
      </Button>
      <Button
        size="sm"
        variant="transparent"
        :outline="false"
        content-class-name="gap-1.5 px-2.5 [&>svg]:size-3.5"
        class="text-muted-foreground hover:text-foreground"
        @click="showInApps"
      >
        Details
        <ArrowRight :stroke-width="1.8" />
      </Button>
    </Surface>
  </section>
</template>
