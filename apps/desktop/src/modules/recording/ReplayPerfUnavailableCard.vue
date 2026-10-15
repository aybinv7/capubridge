<script setup lang="ts">
import type { Component } from "vue";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

defineProps<{
  title: string;
  icon: Component;
  metric: string;
}>();
</script>

<template>
  <Card data-testid="perf-unavailable" :data-metric="metric">
    <CardHeader class="pb-1">
      <CardTitle class="text-sm font-medium flex items-center gap-2 text-muted-foreground">
        <component :is="icon" class="h-4 w-4 opacity-60" /> {{ title }}
      </CardTitle>
    </CardHeader>
    <CardContent>
      <p class="text-xs text-muted-foreground/60">Not recorded</p>
      <p class="text-[10px] text-muted-foreground/40 mt-0.5">
        This recorder had no access to {{ metric }} on the device.
      </p>
    </CardContent>
  </Card>
</template>
