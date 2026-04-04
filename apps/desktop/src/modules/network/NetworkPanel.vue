<script setup lang="ts">
import { RouterView } from "vue-router";
import SubNavTabs from "@/components/layout/SubNavTabs.vue";
import { Search, Pause, Trash2, Download } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ref } from "vue";

const filterText = ref("");
const typeFilter = ref("All");
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <SubNavTabs />

    <div class="h-10 border-b border-border bg-background flex items-center px-3 gap-2 shrink-0">
      <div
        class="flex items-center gap-1 bg-accent rounded-md px-2 py-1 flex-1 max-w-xs border border-border focus-within:border-border transition-colors"
      >
        <Search class="w-3 h-3 text-muted-foreground" />
        <Input
          v-model="filterText"
          class="h-5 text-2xs font-mono bg-transparent border-0 focus-visible:ring-0 px-0 placeholder:text-muted-foreground"
          placeholder="Filter by URL, method, status…"
        />
      </div>

      <div class="flex items-center gap-0.5 text-2xs">
        <Button
          v-for="f in ['All', 'Fetch', 'WS', 'Doc', 'Img']"
          :key="f"
          :variant="typeFilter === f ? 'secondary' : 'ghost'"
          size="sm"
          class="h-6 px-2 text-2xs"
          :class="typeFilter === f ? '' : 'text-muted-foreground'"
          @click="typeFilter = f"
        >
          {{ f }}
        </Button>
      </div>

      <div class="flex-1" />

      <div class="flex items-center gap-0.5">
        <Button
          v-for="(Icon, i) in [Pause, Trash2, Download]"
          :key="i"
          variant="ghost"
          size="icon-sm"
          class="w-7 h-7 text-muted-foreground"
        >
          <component :is="Icon" class="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>

    <div class="flex-1 overflow-hidden">
      <RouterView />
    </div>
  </div>
</template>
