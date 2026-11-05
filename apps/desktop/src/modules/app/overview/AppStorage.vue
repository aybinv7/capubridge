<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { ArrowRight } from "lucide-vue-next";
import { Button } from "@capubridge/cladd";
import type { AdbPackage, AdbPackageDetails } from "@/types/adb.types";
import AppFolderList from "@/shared/apps/AppFolderList.vue";
import AppSizeBreakdown from "@/shared/apps/AppSizeBreakdown.vue";
import { appFolders } from "@/shared/apps/appFolders";
import { DATA_LINKS } from "./dataLinks";

const props = defineProps<{
  packageName: string;
  entry: AdbPackage | null;
  details: AdbPackageDetails | undefined;
}>();

const router = useRouter();

const app = computed<AdbPackage>(
  () =>
    props.entry ?? {
      packageName: props.packageName,
      apkPath: props.details?.apkPath ?? "",
      system: false,
      enabled: true,
    },
);
const folders = computed(() => appFolders(app.value, props.details));

function openFolder(path: string) {
  void router.push({ name: "devices-files", query: { path } });
}

function openData(route: string) {
  void router.push({ name: route });
}
</script>

<template>
  <section class="flex flex-col gap-3" aria-labelledby="app-storage-title">
    <h2 id="app-storage-title" class="text-sm font-medium text-foreground">Storage</h2>
    <AppSizeBreakdown :details="props.details" />
    <div class="flex flex-col gap-1.5">
      <h3 class="text-xs text-muted-foreground">Folders</h3>
      <AppFolderList :folders="folders" @open="openFolder" />
    </div>
    <div class="flex flex-col gap-1.5">
      <h3 class="text-xs text-muted-foreground">Open in Data</h3>
      <div class="flex flex-wrap gap-1.5">
        <Button
          v-for="link in DATA_LINKS"
          :key="link.route"
          size="sm"
          variant="transparent"
          content-class-name="gap-1.5 px-2.5 [&>svg]:size-3.5"
          @click="openData(link.route)"
        >
          {{ link.label }}
          <ArrowRight :stroke-width="1.8" class="text-[var(--fg-subtle)]" />
        </Button>
      </div>
    </div>
  </section>
</template>
