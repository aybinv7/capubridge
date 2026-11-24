<script setup lang="ts">
import { computed } from "vue";
import { Plus } from "lucide-vue-next";
import { Button, StatusDot } from "@capubridge/cladd";
import KeyCaps from "@/components/command/KeyCaps.vue";
import HintTooltip from "@/shared/components/presentation/HintTooltip.vue";
import { bindingTokens } from "@/lib/commands/keymap";

/**
 * Editing a table: add a row, save or drop the changes made so far, and where saving writes.
 * For an opened file, `savesTo` is the file that was picked and `unsaved` says its working copy
 * holds changes that did not reach it (a save that failed). For the app's database in the
 * page's OPFS (`onPhone`), saving pauses the app and writes there, so there is no file to name.
 */
const props = defineProps<{
  pending: number;
  saving: boolean;
  note: string | null;
  savesTo: string | null;
  unsaved: boolean;
  onPhone?: boolean;
}>();

const emit = defineEmits<{
  addRow: [];
  discard: [];
  save: [];
  saveFile: [];
  saveAs: [];
}>();

const fileName = computed(() => props.savesTo?.split(/[\\/]/).pop() ?? "the file");
</script>

<template>
  <div
    class="flex shrink-0 items-center gap-2 border-b border-border-subtle px-3 py-1.5"
    role="toolbar"
    aria-label="Changes to the file"
  >
    <Button size="sm" variant="solid" content-class-name="gap-1.5" @click="emit('addRow')">
      <Plus :size="14" :stroke-width="1.8" />
      Add a row
      <KeyCaps :keys="bindingTokens('mod+shift+n')" quiet />
    </Button>
    <span v-if="note" class="min-w-0 truncate text-xs text-foreground" role="status">
      {{ note }}
    </span>
    <span
      v-else-if="unsaved"
      class="flex min-w-0 items-center gap-1.5 text-xs text-foreground"
      role="status"
    >
      <StatusDot color="yellow" size="xs" />
      <HintTooltip :text="savesTo">
        <span class="truncate" tabindex="0">Not written to “{{ fileName }}” yet</span>
      </HintTooltip>
    </span>
    <span v-else-if="onPhone" class="min-w-0 truncate text-xs text-muted-foreground">
      Double-click a cell to edit. Saving pauses the app and writes to its database on the phone.
    </span>
    <HintTooltip v-else :text="savesTo">
      <span class="min-w-0 truncate text-xs text-muted-foreground" tabindex="0">
        Double-click a cell to edit. Saving writes to “{{ fileName }}” on this computer.
      </span>
    </HintTooltip>
    <div class="ml-auto flex shrink-0 items-center gap-2">
      <span v-if="pending > 0" class="text-xs text-foreground tabular-nums" role="status">
        {{ pending === 1 ? "1 change not saved" : `${pending} changes not saved` }}
      </span>
      <Button
        v-if="!onPhone"
        size="sm"
        variant="transparent"
        :disabled="saving"
        @click="emit('saveAs')"
      >
        Save as…
      </Button>
      <Button
        v-if="unsaved && !onPhone"
        size="sm"
        :variant="pending > 0 ? 'solid' : 'solid-fill'"
        :color="pending > 0 ? undefined : 'brand'"
        :disabled="saving"
        @click="emit('saveFile')"
      >
        Save to the file
      </Button>
      <template v-if="pending > 0">
        <Button size="sm" variant="transparent" :disabled="saving" @click="emit('discard')">
          Discard
        </Button>
        <Button
          size="sm"
          variant="solid-fill"
          color="brand"
          :loading="saving"
          content-class-name="gap-1.5"
          @click="emit('save')"
        >
          {{ onPhone ? "Save to the phone" : "Save changes" }}
          <KeyCaps :keys="bindingTokens('mod+s')" quiet />
        </Button>
      </template>
    </div>
  </div>
</template>
