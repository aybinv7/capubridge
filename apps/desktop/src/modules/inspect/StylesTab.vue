<script setup lang="ts">
import type { MatchedStyles } from "@/types/inspect.types";

defineProps<{
  styles: MatchedStyles | null;
  isLoading: boolean;
}>();
</script>

<template>
  <div class="text-xs font-mono overflow-auto p-2 space-y-3">
    <div v-if="isLoading" class="text-muted-foreground/40 text-center py-4">Loading styles...</div>

    <template v-else-if="styles">
      <!-- Inline styles -->
      <div v-if="styles.inlineStyle?.cssProperties.length" class="space-y-1">
        <div class="text-muted-foreground/60 text-[10px] uppercase tracking-wide">
          element.style
        </div>
        <div class="pl-2 border-l-2 border-orange-400/30 space-y-0.5">
          <div
            v-for="prop in styles.inlineStyle.cssProperties.filter((p) => !p.disabled && p.value)"
            :key="prop.name"
            class="flex gap-1"
          >
            <span class="text-blue-400">{{ prop.name }}</span>
            <span class="text-muted-foreground">:</span>
            <span class="text-foreground/80">{{ prop.value }}</span>
            <span v-if="prop.important" class="text-red-400">!important</span>
            <span class="text-muted-foreground">;</span>
          </div>
        </div>
      </div>

      <!-- Matched rules -->
      <div v-for="(match, i) in styles.matchedCSSRules" :key="i" class="space-y-1">
        <div class="text-muted-foreground/60 text-[10px]">
          <span
            :class="
              match.rule.origin === 'user-agent' ? 'text-muted-foreground/30' : 'text-yellow-400/70'
            "
          >
            {{ match.rule.selectorList.text }}
          </span>
        </div>
        <div class="pl-2 border-l-2 border-border/30 space-y-0.5">
          <div
            v-for="prop in match.rule.style.cssProperties.filter((p) => !p.disabled && p.value)"
            :key="prop.name"
            class="flex gap-1"
          >
            <span class="text-blue-400">{{ prop.name }}</span>
            <span class="text-muted-foreground">:</span>
            <span class="text-foreground/80">{{ prop.value }}</span>
            <span class="text-muted-foreground">;</span>
          </div>
        </div>
      </div>
    </template>

    <div v-else class="text-muted-foreground/40 text-center py-4">
      Select an element to see styles
    </div>
  </div>
</template>
