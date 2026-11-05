<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { useQuery } from "@tanstack/vue-query";
import { ArrowRight, Play } from "lucide-vue-next";
import { Button, Surface } from "@capubridge/cladd";
import { toast } from "vue-sonner";
import { useAdb } from "@/composables/useAdb";
import { PACKAGE_CACHE_STALE_MS, useAppPackages } from "@/composables/useAppPackages";
import { useTargetsStore } from "@/stores/targets.store";
import AppIcon from "../AppIcon.vue";

const props = defineProps<{ serial: string }>();

const router = useRouter();
const targets = useTargetsStore();
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
const label = computed(() => cached.value?.label?.trim() || packageName.value || "");

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

async function launch() {
  if (!packageName.value) return;
  launching.value = true;
  try {
    await openPackage(props.serial, packageName.value);
    toast.success(`${label.value} opened on the phone`);
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
      <span class="flex min-w-0 flex-1 flex-col gap-0.5">
        <span class="truncate text-sm font-medium text-foreground">{{ label }}</span>
        <span class="flex min-w-0 items-center gap-1.5 text-2xs text-[var(--fg-subtle)]">
          <span v-if="version" class="shrink-0 text-muted-foreground">{{ version }}</span>
          <span v-if="version" aria-hidden="true">·</span>
          <span class="truncate font-mono">{{ packageName }}</span>
        </span>
      </span>
      <Button
        size="sm"
        variant="transparent"
        :loading="launching"
        content-class-name="gap-1.5 px-2.5 [&>svg]:size-3.5"
        @click="launch"
      >
        <Play :stroke-width="1.8" />
        Open
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
