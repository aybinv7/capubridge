<script setup lang="ts">
import { Tab, Tabs, TabsList } from "@capubridge/cladd";
import type { NetworkEntry } from "@/types/network.types";
import CookiesTab from "./CookiesTab.vue";
import HeadersTab from "./HeadersTab.vue";
import PayloadTab from "./PayloadTab.vue";
import RequestDetailsHeader from "./RequestDetailsHeader.vue";
import ResponseTab from "./ResponseTab.vue";
import TimingTab from "./TimingTab.vue";
import { DETAIL_TABS, asDetailTab, type DetailTab } from "./detailTabs";
import type { RequestActions } from "./useRequestActions";
import type { RequestBodies } from "./useRequestBodies";

const props = defineProps<{
  entry: NetworkEntry;
  findSignal: number;
  bodies: RequestBodies;
  actions: RequestActions;
}>();

const tab = defineModel<DetailTab>("tab", { required: true });

const emit = defineEmits<{ close: [] }>();

const bodies = props.bodies;
const actions = props.actions;
</script>

<template>
  <section class="flex h-full min-h-0 flex-col" aria-label="Request details">
    <RequestDetailsHeader
      :entry="props.entry"
      :busy="actions.busy.value"
      :can-mock="actions.canMock"
      @copy="actions.copy(props.entry, $event)"
      @mock="actions.mockResponse(props.entry)"
      @close="emit('close')"
    />
    <Tabs :value="tab" @update:value="tab = asDetailTab($event)">
      <TabsList
        aria-label="Request details"
        size="sm"
        active-variant="solid"
        :rounded="false"
        class="shrink-0 justify-start gap-0.5 border-b border-border-subtle px-2.5 py-1.5"
      >
        <Tab
          v-for="option in DETAIL_TABS"
          :key="option.value"
          :value="option.value"
          class="text-xs font-normal text-muted-foreground data-active:font-medium data-active:text-foreground"
        >
          {{ option.label }}
        </Tab>
      </TabsList>
    </Tabs>
    <div class="min-h-0 flex-1">
      <HeadersTab v-if="tab === 'headers'" :entry="props.entry" />
      <PayloadTab
        v-else-if="tab === 'payload'"
        :entry="props.entry"
        :body="bodies.payload.data.value"
        :loading="bodies.payload.isFetching.value"
        :error="bodies.payload.error.value"
        :find-signal="props.findSignal"
        @retry="bodies.payload.refetch()"
      />
      <ResponseTab
        v-else-if="tab === 'response'"
        :key="props.entry.requestId"
        :entry="props.entry"
        :body="bodies.response.data.value"
        :loading="bodies.response.isFetching.value"
        :error="bodies.response.error.value"
        :find-signal="props.findSignal"
        @retry="bodies.response.refetch()"
      />
      <TimingTab v-else-if="tab === 'timing'" :entry="props.entry" />
      <CookiesTab v-else :entry="props.entry" />
    </div>
  </section>
</template>
