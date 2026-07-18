<script setup lang="ts">
import { computed } from "vue";
import { useQuery } from "@tanstack/vue-query";
import ApplicationIcon from "@/shared/components/presentation/ApplicationIcon.vue";
import { invokeCommand } from "@/runtime/ipc/client";

const props = defineProps<{
  serial: string;
  apkPath: string;
  packageName: string;
  iconPath?: string | null;
  size?: "sm" | "md" | "lg";
}>();

const { data: iconUrl, isFetching } = useQuery({
  queryKey: computed(() => [
    "app-icon",
    props.serial,
    props.packageName,
    props.apkPath,
    props.iconPath ?? "",
  ]),
  queryFn: () =>
    invokeCommand("adb_get_app_icon", {
      serial: props.serial,
      apkPath: props.apkPath,
      packageName: props.packageName,
      iconPath: props.iconPath,
    }),
  staleTime: Infinity,
  gcTime: 1000 * 60 * 60,
  enabled: computed(() => !!props.serial && !!props.packageName),
  retry: false,
});
</script>

<template>
  <ApplicationIcon
    :identifier="packageName"
    :source="iconUrl"
    :loading="isFetching"
    :size="size"
    :alt="`${packageName} icon`"
  />
</template>
