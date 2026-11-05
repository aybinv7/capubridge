<script setup lang="ts">
import { ArrowRight } from "lucide-vue-next";
import { Button } from "@capubridge/cladd";
import { DEFAULT_RULE_TEMPLATES, type MockRule } from "@/types/mock.types";
import { TONE_CLASS, statusTone } from "../requests/requestCells";

const props = defineProps<{ canOpenRequests: boolean }>();

const emit = defineEmits<{ create: [template?: Partial<MockRule>]; openRequests: [] }>();

const starters = DEFAULT_RULE_TEMPLATES.map((template) => ({
  ...template,
  status: template.rule.statusCode ?? 200,
  tone: TONE_CLASS[statusTone(template.rule.statusCode ?? 200)],
}));
</script>

<template>
  <div class="flex h-full min-h-0 overflow-y-auto">
    <div class="m-auto flex w-full max-w-2xl flex-col gap-5 p-8">
      <div class="flex flex-col gap-1.5">
        <h2 class="text-base font-medium text-foreground">
          Answer requests with your own responses
        </h2>
        <p class="text-xs text-muted-foreground">
          A rule answers the requests it matches with the status, headers and body you write, so you
          can try errors, slow servers and new data without touching the backend.
        </p>
      </div>

      <div class="flex flex-col gap-2">
        <span class="text-xs text-muted-foreground">Start from</span>
        <div class="grid grid-cols-2 gap-1.5 @xl:grid-cols-3">
          <Button
            v-for="starter in starters"
            :key="starter.label"
            size="md"
            variant="transparent"
            content-class-name="w-full justify-between gap-3"
            class="justify-start"
            @click="emit('create', starter.rule)"
          >
            <span class="truncate text-xs text-foreground">{{ starter.label }}</span>
            <span class="font-mono text-2xs tabular-nums" :class="starter.tone">
              {{ starter.status }}
            </span>
          </Button>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2 border-t border-border-subtle pt-4">
        <Button size="sm" variant="solid-fill" @click="emit('create')">New empty rule</Button>
        <Button
          v-if="props.canOpenRequests"
          size="sm"
          variant="transparent"
          content-class-name="gap-1.5"
          @click="emit('openRequests')"
        >
          Mock a real response from Requests
          <ArrowRight :size="12" :stroke-width="1.8" aria-hidden="true" />
        </Button>
      </div>
    </div>
  </div>
</template>
