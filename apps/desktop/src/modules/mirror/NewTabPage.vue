<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useNow } from "@vueuse/core";
import { Globe } from "lucide-vue-next";
import { Input } from "@capubridge/cladd";
import LocalPageHistoryRow from "@/components/device-manager/LocalPageHistoryRow.vue";
import { normalizeInspectableUrl } from "@/lib/inspect-url";
import { toast } from "@/lib/toast";
import { useLocalPageHistoryStore } from "@/stores/localPageHistory.store";

/**
 * What an empty tab on This PC shows: one field to open a page and the pages opened before, so
 * picking This PC goes straight to a page instead of through a target list.
 */
const emit = defineEmits<{ open: [url: string] }>();

const history = useLocalPageHistoryStore();
const now = useNow({ interval: 30_000 });
const address = ref("");
const field = ref<InstanceType<typeof Input> | null>(null);

function submit() {
  const url = normalizeInspectableUrl(address.value);
  if (!url) {
    toast.error(`“${address.value.trim()}” is not an address`, {
      description: "Type a URL such as localhost:5173 or https://example.com.",
    });
    return;
  }
  emit("open", url);
}

onMounted(() => field.value?.focus());
</script>

<template>
  <div class="flex h-full w-full justify-center overflow-y-auto bg-surface-0 px-6">
    <div class="flex w-full max-w-[520px] flex-col gap-6 pt-[18vh] pb-10">
      <form class="flex flex-col gap-2" @submit.prevent="submit">
        <label for="new-tab-address" class="text-sm font-medium text-foreground">
          Open a page on This PC
        </label>
        <Input
          input-id="new-tab-address"
          ref="field"
          v-model="address"
          size="xl"
          input-mode="url"
          placeholder="localhost:5173"
          :input-props="{ spellcheck: false, autocomplete: 'off' }"
        >
          <template #icon>
            <Globe :stroke-width="1.8" class="text-[var(--fg-subtle)]" />
          </template>
        </Input>
        <p class="text-2xs text-[var(--fg-subtle)]">
          It opens in a tab with full DevTools: Data, Network and Elements follow the tab you pick.
        </p>
      </form>

      <section v-if="history.visits.length" class="flex flex-col gap-1">
        <h3 class="px-2 text-xs text-muted-foreground">Recent</h3>
        <div class="flex flex-col gap-0.5">
          <LocalPageHistoryRow
            v-for="visit in history.visits"
            :key="visit.url"
            :visit="visit"
            :now="now.getTime()"
            @open="emit('open', visit.url)"
            @forget="history.forget(visit.url)"
          />
        </div>
      </section>
    </div>
  </div>
</template>
