<script setup lang="ts">
import { ref } from "vue";
import { FileJson, AlertTriangle, CheckCircle, Info, ExternalLink, Copy } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { mockCapacitorConfig, mockAppInfo } from "@/data/mock-data";

const configTab = ref<"config" | "app" | "issues">("config");

const issues = [
  {
    severity: "warn" as const,
    message: "allowMixedContent is enabled — HTTP requests allowed in WebView",
    detail: "This is a security risk in production builds",
  },
  {
    severity: "info" as const,
    message: "Server URL points to localhost (dev mode)",
    detail: "Will not work in production builds",
  },
  {
    severity: "info" as const,
    message: "@capacitor/storage is deprecated",
    detail: "Use @capacitor/preferences instead",
  },
];

function severityIcon(severity: string) {
  if (severity === "warn") return AlertTriangle;
  return Info;
}

function severityColor(severity: string) {
  if (severity === "warn") return "text-warning";
  return "text-info";
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <!-- Tabs -->
    <div class="h-8 shrink-0 border-b border-border/20 bg-surface-1 flex items-center px-3 gap-0.5">
      <Button
        v-for="tab in ['config', 'app', 'issues'] as const"
        :key="tab"
        :variant="configTab === tab ? 'secondary' : 'ghost'"
        size="sm"
        class="h-6 px-3 text-2xs capitalize"
        :class="configTab === tab ? '' : 'text-muted-foreground'"
        @click="configTab = tab"
      >
        <FileJson v-if="tab === 'config'" class="w-3 h-3 mr-1.5" />
        <CheckCircle v-else-if="tab === 'app'" class="w-3 h-3 mr-1.5" />
        <AlertTriangle v-else class="w-3 h-3 mr-1.5" />
        {{ tab === "config" ? "Config" : tab === "app" ? "App Info" : `Issues (${issues.length})` }}
      </Button>
    </div>

    <div class="flex-1 overflow-y-auto p-4">
      <!-- Config view -->
      <div v-if="configTab === 'config'" class="max-w-2xl space-y-3">
        <div class="flex items-center justify-between mb-2">
          <h3 class="text-sm font-medium text-foreground">capacitor.config.json</h3>
          <Button variant="ghost" size="sm" class="gap-1.5 text-2xs text-muted-foreground">
            <Copy class="w-3 h-3" />
            Copy JSON
          </Button>
        </div>
        <pre
          class="text-xs font-mono text-foreground bg-surface-2/50 rounded-lg p-4 border border-border/10 overflow-x-auto"
          >{{ JSON.stringify(mockCapacitorConfig, null, 2) }}</pre
        >
      </div>

      <!-- App Info view -->
      <div v-else-if="configTab === 'app'" class="max-w-2xl space-y-3">
        <h3 class="text-sm font-medium text-foreground mb-3">Application Info</h3>
        <div class="grid grid-cols-2 gap-2">
          <div
            v-for="[label, value] in [
              ['Package', mockAppInfo.packageName],
              ['Version', `${mockAppInfo.versionName} (${mockAppInfo.versionCode})`],
              ['Build Type', mockAppInfo.buildType],
              ['Platform', `${mockAppInfo.platform} ${mockAppInfo.osVersion}`],
              ['Device', mockAppInfo.deviceModel],
              ['WebView', mockAppInfo.webViewVersion],
              ['Capacitor', mockAppInfo.capacitorVersion],
              ['CLI', mockAppInfo.cliVersion],
              ['Min SDK', String(mockAppInfo.minSdkVersion)],
              ['Target SDK', String(mockAppInfo.targetSdkVersion)],
              ['Install Source', mockAppInfo.installSource],
              ['Last Update', mockAppInfo.lastUpdate.slice(0, 10)],
            ]"
            :key="label"
            class="bg-surface-2/50 rounded-md p-2.5 border border-border/10"
          >
            <div class="text-2xs text-dimmed mb-0.5">{{ label }}</div>
            <div class="text-xs font-mono text-foreground">{{ value }}</div>
          </div>
        </div>
      </div>

      <!-- Issues view -->
      <div v-else class="max-w-2xl space-y-2">
        <h3 class="text-sm font-medium text-foreground mb-3">Configuration Issues</h3>
        <div
          v-for="issue in issues"
          :key="issue.message"
          class="rounded-lg border p-3"
          :class="
            issue.severity === 'warn'
              ? 'border-warning/20 bg-warning/[0.03]'
              : 'border-border/15 bg-surface-2/30'
          "
        >
          <div class="flex items-center gap-2 mb-1">
            <component
              :is="severityIcon(issue.severity)"
              class="w-3.5 h-3.5"
              :class="severityColor(issue.severity)"
            />
            <span class="text-xs font-medium text-foreground">{{ issue.message }}</span>
          </div>
          <p class="text-2xs text-muted-foreground ml-5">{{ issue.detail }}</p>
        </div>
      </div>
    </div>
  </div>
</template>
