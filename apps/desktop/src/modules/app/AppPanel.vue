<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import GatedRouterView from "@/components/gate/GatedRouterView.vue";
import GatedView from "@/components/gate/GatedView.vue";
import SubNavTabs from "@/components/layout/SubNavTabs.vue";
import ConfirmDialog from "@/shared/components/presentation/ConfirmDialog.vue";
import { provideAppSession } from "./appSession";
import UnknownAppNotice from "./UnknownAppNotice.vue";
import { useAppCommands } from "./useAppCommands";

const PROCESS_ROUTES = new Set(["app-overview", "app-performance"]);

const route = useRoute();
const session = provideAppSession(computed(() => PROCESS_ROUTES.has(String(route.name ?? ""))));
const { confirmOpen, confirmRequest, confirm } = session.lifecycle;
const { unknownApp, target } = session.app;

useAppCommands(session);
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <SubNavTabs />
    <div class="flex-1 overflow-hidden">
      <GatedView v-if="unknownApp" requirement="app-target">
        <UnknownAppNotice :reported="target?.packageName ?? null" />
      </GatedView>
      <GatedRouterView v-else />
    </div>
    <ConfirmDialog v-model:open="confirmOpen" :request="confirmRequest" @confirm="confirm()" />
  </div>
</template>
