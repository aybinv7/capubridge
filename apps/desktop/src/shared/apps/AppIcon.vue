<script setup lang="ts">
import { computed } from "vue";
import { useQuery } from "@tanstack/vue-query";
import ApplicationIcon from "@/shared/components/presentation/ApplicationIcon.vue";
import { invokeCommand } from "@/runtime/ipc/client";
import { queueIconRead } from "./iconQueue";

const props = withDefaults(
  defineProps<{
    serial: string;
    apkPath: string;
    packageName: string;
    iconPath?: string | null;
    resolve?: boolean;
    size?: "xs" | "sm" | "md" | "lg";
    /** The app's name, for the letter shown until the icon arrives or when it has none. */
    label?: string | null;
  }>(),
  {
    iconPath: null,
    resolve: true,
    size: "md",
    label: null,
  },
);

const { data: iconUrl, isFetching } = useQuery({
  queryKey: computed(() => ["app-icon", props.serial, props.packageName]),
  queryFn: async ({ signal }): Promise<string | null> => {
    try {
      return await queueIconRead(
        () =>
          invokeCommand("adb_get_app_icon", {
            serial: props.serial,
            apkPath: props.apkPath,
            packageName: props.packageName,
            iconPath: props.iconPath ?? undefined,
          }),
        signal,
      );
    } catch (error) {
      if (signal.aborted) throw error;
      return null;
    }
  },
  staleTime: Infinity,
  gcTime: 1000 * 60 * 60,
  enabled: computed(() => props.resolve !== false && !!props.serial && !!props.packageName),
  retry: false,
});
</script>

<template>
  <ApplicationIcon
    :identifier="props.packageName"
    :label="props.label"
    :source="iconUrl"
    :loading="props.resolve !== false && isFetching"
    :size="props.size"
    :alt="`${props.label ?? props.packageName} icon`"
  />
</template>
