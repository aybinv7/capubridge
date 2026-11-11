<script setup lang="ts">
import { computed } from "vue";
import { ArrowUpRight } from "lucide-vue-next";
import { Button, Tooltip } from "@capubridge/cladd";
import { useAppPackages } from "@/composables/useAppPackages";
import { useGateActions } from "@/composables/useGateActions";
import { targetAppName } from "@/lib/target-app-name";
import { useActiveContextStore } from "@/stores/activeContext.store";
import { useTargetPresenceStore } from "@/stores/targetPresence.store";

/**
 * The one "Bring to front" in the app, in the title bar where it is always seen: while the picked
 * app is in the background on the phone, Android may freeze it and nothing can read from it, and
 * the phone's screen shows whatever is in front instead.
 */
const context = useActiveContextStore();
const presence = useTargetPresenceStore();
const gate = useGateActions();

const serial = computed(() => context.device?.serial ?? "");
const { getCachedPackage } = useAppPackages(serial);

const app = computed(() => {
  const target = context.target;
  if (target?.source !== "adb" || !target.packageName) return null;
  if (presence.presence !== "background") return null;
  return targetAppName(target, getCachedPackage(target.packageName)?.label) ?? target.packageName;
});

const busy = computed(() => gate.running.value === "bring-to-front");

function bringToFront() {
  void gate.run("bring-to-front", "Bring app to front");
}
</script>

<template>
  <Transition
    enter-active-class="transition-[opacity,translate] duration-300 ease-cladd-settle motion-reduce:transition-none"
    leave-active-class="transition-[opacity,translate] duration-150 ease-in motion-reduce:transition-none"
    enter-from-class="-translate-x-1 opacity-0"
    leave-to-class="-translate-x-1 opacity-0"
  >
    <div v-if="app" class="flex">
      <Tooltip
        position="bottom"
        :offset="6"
        content-class-name="flex max-w-64 flex-col gap-0.5 px-2 py-1 text-xs"
      >
        <template #trigger>
          <Button
            variant="solid"
            surface-level="1"
            class="h-7.5 border border-border"
            style="-webkit-app-region: no-drag"
            content-class-name="gap-1.5 px-2.5 [&>svg]:size-3.5"
            :loading="busy"
            :aria-label="`Bring ${app} to the front`"
            @click="bringToFront"
          >
            <span class="size-1.5 shrink-0 rounded-full bg-signal-mark" aria-hidden="true" />
            <ArrowUpRight :stroke-width="1.8" class="text-muted-foreground" />
          </Button>
        </template>
        <span class="text-foreground">Bring {{ app }} to the front</span>
        <span class="text-muted-foreground">
          It is in the background, so the phone shows another app and cannot answer.
        </span>
      </Tooltip>
    </div>
  </Transition>
</template>
