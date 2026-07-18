<script setup lang="ts">
import { computed } from "vue";
import { useQuery } from "@tanstack/vue-query";
import ApplicationIcon from "@/shared/components/presentation/ApplicationIcon.vue";
import { invokeCommand } from "@/runtime/ipc/client";

const props = withDefaults(
  defineProps<{
    serial: string;
    apkPath: string;
    packageName: string;
    iconPath?: string | null;
    resolve?: boolean;
    size?: "sm" | "md" | "lg";
  }>(),
  {
    resolve: true,
  },
);

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
  enabled: computed(() => props.resolve !== false && !!props.serial && !!props.packageName),
  retry: false,
});
</script>

<template>
  <ApplicationIcon
    :identifier="packageName"
    :source="iconUrl"
    :loading="props.resolve !== false && isFetching"
    :size="size"
    :alt="`${packageName} icon`"
  />
</template>
