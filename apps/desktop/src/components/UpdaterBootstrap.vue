<script setup lang="ts">
// Renderless: starts the background update check and surfaces a toast when an
// update becomes available. Mounted once in the main app window only.
import { onMounted, watch } from "vue";
import { useRouter } from "vue-router";
import { toast } from "vue-sonner";
import { useUpdaterStore } from "@/stores/updater.store";

const updater = useUpdaterStore();
const router = useRouter();

let toastedVersion: string | null = null;

onMounted(() => {
  updater.startAutoCheck();
});

watch(
  () => (updater.status === "available" ? updater.info?.version : null),
  (version) => {
    if (!version || version === toastedVersion) return;
    toastedVersion = version;
    toast("Update available", {
      description: `Version ${version} is ready to install.`,
      duration: 10000,
      action: {
        label: "Install",
        onClick: () => void router.push("/settings/updates"),
      },
    });
  },
);
</script>

<template>
  <span aria-hidden="true" class="hidden" />
</template>
