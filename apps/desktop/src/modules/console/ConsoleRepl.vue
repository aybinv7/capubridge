<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { Loader2, Play, Trash2 } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { useConsoleStore } from "@/stores/console.store";

const consoleStore = useConsoleStore();

const expression = ref("");
const isRunning = ref(false);
const localError = ref<string | null>(null);

onMounted(() => {
  void consoleStore.initialize();
});

const canRun = computed(
  () => !!consoleStore.boundTargetId && !!expression.value.trim() && !isRunning.value,
);

async function runEvaluation() {
  if (!canRun.value) {
    return;
  }

  localError.value = null;
  isRunning.value = true;

  try {
    await consoleStore.evaluate(expression.value);
    expression.value = "";
  } catch (err) {
    localError.value = err instanceof Error ? err.message : String(err);
  } finally {
    isRunning.value = false;
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.key !== "Enter" || event.shiftKey) {
    return;
  }

  event.preventDefault();
  void runEvaluation();
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col overflow-hidden bg-surface-0">
    <div class="border-b border-border/30 bg-surface-2">
      <div class="flex h-11 items-center gap-2 px-3">
        <div class="min-w-0 flex-1">
          <div class="truncate text-sm font-medium">REPL</div>
          <div class="text-[11px] text-muted-foreground/60">
            {{ consoleStore.activeTargetLabel }} · {{ consoleStore.replHistory.length }} evaluations
          </div>
        </div>
        <Badge
          variant="outline"
          class="h-6 rounded-full border px-2 font-mono text-[10px]"
          :class="
            consoleStore.boundTargetId
              ? 'border-success/30 bg-success/10 text-success'
              : 'border-border/40 bg-surface-3 text-muted-foreground'
          "
        >
          {{ consoleStore.boundTargetId ? "Ready" : "No target" }}
        </Badge>
        <Button variant="ghost" size="sm" class="h-7 w-7" @click="consoleStore.clearReplHistory()">
          <Trash2 class="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>

    <div class="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto]">
      <ScrollArea class="min-h-0">
        <div
          v-if="consoleStore.replHistory.length === 0"
          class="flex h-full min-h-[180px] items-center justify-center text-sm text-muted-foreground/45"
        >
          Run expression against active CDP target.
        </div>

        <div v-else class="space-y-2 p-3">
          <section
            v-for="entry in [...consoleStore.replHistory].reverse()"
            :key="entry.id"
            class="rounded-xl border p-3"
            :class="
              entry.status === 'error'
                ? 'border-error/20 bg-error/6'
                : 'border-border/25 bg-surface-2'
            "
          >
            <div class="flex items-center justify-between gap-3">
              <span class="font-mono text-[10px] text-muted-foreground/60">{{
                entry.timestampLabel
              }}</span>
              <Badge
                variant="outline"
                class="h-5 rounded-full border px-1.5 font-mono text-[10px]"
                :class="
                  entry.status === 'error'
                    ? 'border-error/30 bg-error/10 text-error'
                    : 'border-success/30 bg-success/10 text-success'
                "
              >
                {{ entry.status }}
              </Badge>
            </div>
            <pre
              class="mt-2 overflow-x-auto rounded-lg bg-background/70 p-3 font-mono text-[11px] text-sky-300"
              >{{ entry.expression }}</pre
            >
            <pre
              class="mt-2 overflow-x-auto rounded-lg bg-background/70 p-3 font-mono text-[11px]"
              :class="entry.status === 'error' ? 'text-error' : 'text-foreground/85'"
              >{{ entry.result }}</pre
            >
          </section>
        </div>
      </ScrollArea>

      <div class="border-t border-border/30 bg-surface-2 p-3">
        <Textarea
          v-model="expression"
          class="min-h-[88px] resize-none border-border/30 bg-surface-3 font-mono text-xs leading-5"
          placeholder="document.title&#10;window.Capacitor?.getPlatform?.()&#10;indexedDB.databases?.()"
          @keydown="onKeydown"
        />
        <div class="mt-2 flex items-center gap-2">
          <div class="text-[11px] text-muted-foreground/60">
            Enter to run · Shift+Enter for newline
          </div>
          <div v-if="localError" class="truncate text-[11px] text-error">{{ localError }}</div>
          <div class="ml-auto">
            <Button
              size="sm"
              class="h-8 gap-1.5 px-3"
              :disabled="!canRun"
              @click="void runEvaluation()"
            >
              <Loader2 v-if="isRunning" class="h-3.5 w-3.5 animate-spin" />
              <Play v-else class="h-3.5 w-3.5" />
              Run
            </Button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
