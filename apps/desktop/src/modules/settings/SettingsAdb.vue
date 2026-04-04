<script setup lang="ts">
import { ref } from "vue";
import { Terminal } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const adbPath = ref("");
const pollingInterval = ref("3s");
</script>

<template>
  <div class="flex-1 overflow-y-auto p-5">
    <div class="max-w-xl space-y-6">
      <div>
        <h3 class="text-sm font-medium text-foreground mb-3">ADB Configuration</h3>
        <div class="space-y-3">
          <div class="flex items-center justify-between p-3 bg-accent border border-border">
            <div class="flex items-center gap-3">
              <Terminal class="w-4 h-4 text-muted-foreground" />
              <div>
                <Label for="adb-path" class="text-xs font-medium text-foreground">ADB Path</Label>
                <p class="text-2xs text-muted-foreground">Path to the adb binary</p>
              </div>
            </div>
            <Input
              id="adb-path"
              v-model="adbPath"
              class="w-56 h-8 font-mono text-xs"
              placeholder="auto-detect"
            />
          </div>
          <div class="p-3 bg-accent border border-border">
            <span class="text-xs font-medium text-foreground">Polling Interval</span>
            <p class="text-2xs text-muted-foreground mb-2">How often to refresh device list</p>
            <div class="flex gap-1.5">
              <Button
                v-for="ms in ['1s', '3s', '5s', '10s']"
                :key="ms"
                :variant="pollingInterval === ms ? 'default' : 'outline'"
                size="sm"
                @click="pollingInterval = ms"
              >
                {{ ms }}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
