<script setup lang="ts">
import { ref, onMounted } from "vue";
import { ArrowLeftRight, Plus, X, Loader2 } from "lucide-vue-next";
import { toast } from "vue-sonner";
import { useAdb } from "@/composables/useAdb";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const props = defineProps<{ serial: string }>();

const { reverse, removeReverse, listReverse } = useAdb();

const open = ref(false);
const rules = ref<{ remotePort: number; localPort: number }[]>([]);
const remoteInput = ref<number | null>(null);
const localInput = ref<number | null>(null);
const adding = ref(false);
const loading = ref(false);

async function loadRules() {
  loading.value = true;
  try {
    rules.value = await listReverse(props.serial);
  } catch {
    rules.value = [];
  } finally {
    loading.value = false;
  }
}

async function handleAdd() {
  if (!remoteInput.value || !localInput.value) {
    toast.error("Enter both ports");
    return;
  }
  adding.value = true;
  try {
    await reverse(props.serial, remoteInput.value, localInput.value);
    rules.value.push({ remotePort: remoteInput.value, localPort: localInput.value });
    remoteInput.value = null;
    localInput.value = null;
    toast.success(`Reverse rule added`, {
      description: `tcp:${rules.value.at(-1)?.remotePort} → tcp:${rules.value.at(-1)?.localPort}`,
    });
  } catch (err) {
    toast.error("Failed to add reverse rule", { description: String(err) });
  } finally {
    adding.value = false;
  }
}

async function handleRemove(rule: { remotePort: number; localPort: number }) {
  try {
    await removeReverse(props.serial, rule.remotePort);
    rules.value = rules.value.filter((r) => r.remotePort !== rule.remotePort);
  } catch (err) {
    toast.error("Failed to remove rule", { description: String(err) });
  }
}

function handleOpen() {
  open.value = true;
  loadRules();
}
</script>

<template>
  <button
    @click.stop="handleOpen"
    class="flex items-center justify-center w-5 h-5 rounded text-muted-foreground/50 hover:text-foreground hover:bg-surface-3 transition-colors"
    title="Manage ADB reverse rules"
  >
    <ArrowLeftRight :size="10" />
  </button>

  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle class="text-sm flex items-center gap-2">
          <ArrowLeftRight :size="14" class="text-muted-foreground" />
          ADB Reverse
        </DialogTitle>
      </DialogHeader>

      <p class="text-[11px] text-muted-foreground/60 -mt-1">
        Forwards a device TCP port to a local port on this machine.
        <span class="font-mono text-muted-foreground/50">adb reverse tcp:device tcp:local</span>
      </p>

      <!-- Add rule -->
      <div class="flex items-center gap-1.5 mt-1">
        <div class="flex flex-col gap-0.5 flex-1">
          <label class="text-[10px] text-muted-foreground/50 font-medium uppercase tracking-wide"
            >Device</label
          >
          <input
            v-model.number="remoteInput"
            type="number"
            placeholder="3000"
            class="h-7 w-full bg-surface-2 border border-border/40 rounded-md px-2 text-[12px] font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/30"
          />
        </div>
        <ArrowLeftRight :size="12" class="text-muted-foreground/30 mt-4 shrink-0" />
        <div class="flex flex-col gap-0.5 flex-1">
          <label class="text-[10px] text-muted-foreground/50 font-medium uppercase tracking-wide"
            >Local</label
          >
          <input
            v-model.number="localInput"
            type="number"
            placeholder="3000"
            class="h-7 w-full bg-surface-2 border border-border/40 rounded-md px-2 text-[12px] font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/30"
          />
        </div>
        <button
          @click="handleAdd"
          :disabled="adding"
          class="mt-4 h-7 w-7 shrink-0 flex items-center justify-center rounded-md bg-surface-3 border border-border/40 hover:bg-surface-2 hover:border-border/60 transition-colors disabled:opacity-40"
        >
          <Loader2 v-if="adding" :size="12" class="animate-spin" />
          <Plus v-else :size="12" />
        </button>
      </div>

      <!-- Active rules -->
      <div v-if="loading" class="flex items-center justify-center py-3">
        <Loader2 :size="14" class="animate-spin text-muted-foreground/40" />
      </div>

      <div v-else-if="rules.length" class="flex flex-col gap-1 mt-1">
        <div
          class="text-[10px] text-muted-foreground/40 font-medium uppercase tracking-wide mb-0.5"
        >
          Active rules
        </div>
        <div
          v-for="rule in rules"
          :key="rule.remotePort"
          class="flex items-center gap-2 px-2.5 py-1.5 bg-surface-2 border border-border/30 rounded-md"
        >
          <span class="font-mono text-[11px] text-muted-foreground/70 flex-1">
            tcp:{{ rule.remotePort }}
            <span class="text-muted-foreground/30 mx-1">→</span>
            tcp:{{ rule.localPort }}
          </span>
          <button
            @click="handleRemove(rule)"
            class="text-muted-foreground/30 hover:text-foreground transition-colors"
          >
            <X :size="11" />
          </button>
        </div>
      </div>

      <p v-else class="text-[11px] text-muted-foreground/30 text-center py-2 mt-1">
        No active reverse rules
      </p>
    </DialogContent>
  </Dialog>
</template>
