<script setup lang="ts">
import { MessageSquare } from "lucide-vue-next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden bg-surface-0">
    <div class="border-b border-border px-4 py-3">
      <Badge variant="secondary" class="gap-1.5 rounded-full px-3 py-1 text-xs">
        <span class="text-muted-foreground">Context:</span>
        <span>Current workspace</span>
      </Badge>
    </div>

    <div class="flex flex-1 items-center justify-center p-6">
      <div class="max-w-md space-y-4 text-center">
        <div
          class="mx-auto flex size-12 items-center justify-center rounded-2xl border border-border bg-surface-1 text-foreground shadow-sm"
        >
          <MessageSquare class="size-5" />
        </div>
        <div class="space-y-2">
          <h3 class="text-lg font-medium tracking-tight text-foreground">
            Assistant lands in Phase 5
          </h3>
          <p class="text-sm leading-6 text-muted-foreground">
            Dock shell ready now. Logcat, REPL, console, and exceptions already moved here.
          </p>
        </div>
        <div class="flex items-center justify-center gap-2">
          <Badge variant="outline" class="rounded-full px-3 py-1 text-xs">⌘J toggle dock</Badge>
          <Badge variant="outline" class="rounded-full px-3 py-1 text-xs">⌘1-5 switch tabs</Badge>
        </div>
      </div>
    </div>

    <div class="border-t border-border bg-background px-4 py-4">
      <Textarea
        :model-value="''"
        class="min-h-20 resize-none border-border bg-surface-1 text-sm"
        disabled
        placeholder="Composer ships in Phase 5"
      />
      <div class="mt-3 flex items-center justify-between">
        <Badge variant="secondary" class="rounded-full px-3 py-1 text-xs">Model pending</Badge>
        <Button size="sm" disabled>Send</Button>
      </div>
    </div>
  </div>
</template>
