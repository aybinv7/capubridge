<script setup lang="ts">
import {
  Button,
  Dialog,
  List,
  ListButton,
  ListSeparator,
  ListTitle,
  Popover,
  PopoverClose,
  PopoverRoot,
  PopoverTrigger,
  Tooltip,
} from "@capubridge/ui";
import { computed, ref } from "vue";
import type { UiAccent } from "@capubridge/ui";

import CatalogSection from "../components/CatalogSection.vue";
import ComponentPlayground from "../components/ComponentPlayground.vue";
import PlaygroundColorControl from "../components/PlaygroundColorControl.vue";
import PlaygroundSegmented from "../components/PlaygroundSegmented.vue";
import PlaygroundSwitchControl from "../components/PlaygroundSwitchControl.vue";
import PlaygroundToolbar from "../components/PlaygroundToolbar.vue";

const props = defineProps<{
  accent: UiAccent;
  interactionsEnabled: boolean;
}>();

const color = ref<UiAccent>("neutral");
const open = ref(false);
const confirm = ref(false);
const popoverOpen = ref(false);
const popoverPosition = ref("bottom");
const popoverBackdrop = ref(false);
const tooltipPosition = ref("top");

const popoverPositions = ["top", "bottom", "left", "right", "center"] as const;
const tooltipPositions = ["top", "bottom"] as const;

const target = {
  host: "localhost:5175",
  title: "Presalio · Orders",
  url: "/orders?tab=drafts",
};

const code = computed(
  () => `<Dialog
  v-model:open="open"
  color="${color.value}"
  ${confirm.value ? 'confirm-text="Disconnect"' : ':confirm-text="undefined"'}
  title="Disconnect WebView?"
  description="The target can be attached again without losing its stored inspection state."
>
  <template #trigger>
    <Button>Open dialog</Button>
  </template>
</Dialog>`,
);

const popoverCode = computed(
  () => `<Popover
  v-model:open="popoverOpen"
  position="${popoverPosition.value}"${popoverBackdrop.value ? "\n  backdrop" : ""}
  class="w-56"
>
  <template #trigger>
    <Button>Open popover</Button>
  </template>
  <template #default="{ close }">
    <List>
      <ListTitle>Target</ListTitle>
      <ListButton :header="target.host" :footer="target.url" @click="close">
        {{ target.title }}
      </ListButton>
      <ListSeparator />
      <ListButton size="md" @click="close">Reload</ListButton>
      <ListButton size="md" color="red" @click="close">Detach</ListButton>
    </List>
  </template>
</Popover>`,
);

const popoverRootCode = `<PopoverRoot>
  <PopoverTrigger>
    <Button>Target actions</Button>
  </PopoverTrigger>
  <Popover position="bottom-start" class="w-56">
    <List>
      <ListTitle>Storage</ListTitle>
      <PopoverClose>
        <ListButton size="md">Clear IndexedDB</ListButton>
      </PopoverClose>
      <PopoverClose>
        <ListButton size="md">Clear Cache API</ListButton>
      </PopoverClose>
    </List>
  </Popover>
</PopoverRoot>`;

const tooltipCode = computed(
  () => `<Tooltip position="${tooltipPosition.value}" :timeout="false">
  <template #trigger>
    <Button>Hover me</Button>
  </template>
  Forwards the CDP port for this target
</Tooltip>`,
);
</script>

<template>
  <CatalogSection
    description="A portalled dialog with focus management, dismissal and controlled state."
    eyebrow="05 · Overlays"
    id="overlays"
    title="Dialog"
  >
    <ComponentPlayground :code="code" preview-surface>
      <template #preview>
        <Dialog
          v-model:open="open"
          cancel-text="Keep attached"
          :color="color"
          :confirm-text="confirm ? 'Disconnect' : undefined"
          description="The target can be attached again without losing its stored inspection state."
          title="Disconnect WebView?"
        >
          <template #trigger>
            <Button :disabled="!props.interactionsEnabled">Open dialog</Button>
          </template>
        </Dialog>
      </template>
      <template #controls>
        <PlaygroundToolbar>
          <PlaygroundSwitchControl v-model="confirm" label="confirmation action" />
        </PlaygroundToolbar>
        <PlaygroundToolbar>
          <PlaygroundColorControl v-model="color" />
        </PlaygroundToolbar>
      </template>
    </ComponentPlayground>

    <ComponentPlayground :code="popoverCode" preview-surface>
      <template #preview>
        <Popover
          v-model:open="popoverOpen"
          :backdrop="popoverBackdrop"
          class="w-56"
          :position="popoverPosition"
        >
          <template #trigger>
            <Button :disabled="!props.interactionsEnabled">Open popover</Button>
          </template>
          <template #default="{ close }">
            <List>
              <ListTitle>Target</ListTitle>
              <ListButton :footer="target.url" :header="target.host" @click="close">
                {{ target.title }}
              </ListButton>
              <ListSeparator />
              <ListButton size="md" @click="close">Reload</ListButton>
              <ListButton color="red" size="md" @click="close">Detach</ListButton>
            </List>
          </template>
        </Popover>
      </template>
      <template #controls>
        <PlaygroundToolbar>
          <PlaygroundSegmented
            v-model="popoverPosition"
            :items="popoverPositions"
            label="Popover position"
          />
        </PlaygroundToolbar>
        <PlaygroundToolbar>
          <PlaygroundSwitchControl v-model="popoverBackdrop" label="backdrop" />
        </PlaygroundToolbar>
      </template>
    </ComponentPlayground>

    <ComponentPlayground :code="popoverRootCode" preview-surface>
      <template #preview>
        <PopoverRoot>
          <PopoverTrigger>
            <Button :disabled="!props.interactionsEnabled">Target actions</Button>
          </PopoverTrigger>
          <Popover class="w-56" position="bottom-start">
            <List>
              <ListTitle>Storage</ListTitle>
              <PopoverClose>
                <ListButton size="md">Clear IndexedDB</ListButton>
              </PopoverClose>
              <PopoverClose>
                <ListButton size="md">Clear Cache API</ListButton>
              </PopoverClose>
            </List>
          </Popover>
        </PopoverRoot>
      </template>
    </ComponentPlayground>

    <ComponentPlayground :code="tooltipCode" preview-surface>
      <template #preview>
        <Tooltip :position="tooltipPosition" :timeout="false">
          <template #trigger>
            <Button :disabled="!props.interactionsEnabled">Hover me</Button>
          </template>
          Forwards the CDP port for this target
        </Tooltip>
      </template>
      <template #controls>
        <PlaygroundToolbar>
          <PlaygroundSegmented
            v-model="tooltipPosition"
            :items="tooltipPositions"
            label="Tooltip position"
          />
        </PlaygroundToolbar>
      </template>
    </ComponentPlayground>
  </CatalogSection>
</template>
