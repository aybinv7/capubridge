<script setup lang="ts">
import { Palette, Languages, Bell } from "lucide-vue-next";
</script>

<template>
  <div class="flex-1 overflow-y-auto p-5">
    <div class="max-w-xl space-y-6">
      <div>
        <h3 class="text-sm font-medium text-foreground mb-3">Appearance</h3>
        <div class="space-y-3">
          <div class="flex items-center justify-between p-3 bg-accent border border-border">
            <div class="flex items-center gap-3">
              <Palette class="w-4 h-4 text-muted-foreground" />
              <div>
                <span class="text-xs font-medium text-foreground">Theme</span>
                <p class="text-2xs text-muted-foreground">Choose your preferred color scheme</p>
              </div>
            </div>
            <span class="text-2xs font-mono text-muted-foreground bg-secondary px-2 py-1 rounded"
              >Dark</span
            >
          </div>
        </div>
      </div>

      <div>
        <h3 class="text-sm font-medium text-foreground mb-3">Language</h3>
        <div class="flex items-center justify-between p-3 bg-accent border border-border">
          <div class="flex items-center gap-3">
            <Languages class="w-4 h-4 text-muted-foreground" />
            <div>
              <span class="text-xs font-medium text-foreground">Display Language</span>
              <p class="text-2xs text-muted-foreground">Set the UI language</p>
            </div>
          </div>
          <span class="text-2xs font-mono text-muted-foreground bg-secondary px-2 py-1 rounded"
            >English</span
          >
        </div>
      </div>

      <div>
        <h3 class="text-sm font-medium text-foreground mb-3">Notifications</h3>
        <div class="flex items-center justify-between p-3 bg-accent border border-border">
          <div class="flex items-center gap-3">
            <Bell class="w-4 h-4 text-muted-foreground" />
            <div>
              <span class="text-xs font-medium text-foreground">Desktop Notifications</span>
              <p class="text-2xs text-muted-foreground">
                Show system notifications for device events
              </p>
            </div>
          </div>
          <span class="text-2xs font-mono text-muted-foreground bg-secondary px-2 py-1 rounded"
            >Off</span
          >
        </div>
      </div>
    </div>
  </div>
</template>
