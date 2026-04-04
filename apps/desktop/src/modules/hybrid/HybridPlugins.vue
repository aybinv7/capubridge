<script setup lang="ts">
import {
  Camera,
  Bell,
  Map,
  Fingerprint,
  Wifi,
  Share2,
  HardDrive,
  Layers,
  ArrowUpRight,
  ChevronRight,
} from "lucide-vue-next";
import { Button } from "@/components/ui/button";

const plugins = [
  {
    name: "Camera",
    package: "@capacitor/camera",
    version: "5.0.9",
    status: "ok",
    icon: Camera,
    perms: ["CAMERA"],
  },
  {
    name: "Push Notifications",
    package: "@capacitor/push-notifications",
    version: "5.1.2",
    status: "ok",
    icon: Bell,
    perms: ["POST_NOTIFICATIONS"],
  },
  {
    name: "Geolocation",
    package: "@capacitor/geolocation",
    version: "5.0.7",
    status: "ok",
    icon: Map,
    perms: ["ACCESS_FINE_LOCATION"],
  },
  {
    name: "Biometrics",
    package: "capacitor-biometric-auth",
    version: "5.1.0",
    status: "warn",
    icon: Fingerprint,
    perms: ["USE_BIOMETRIC"],
  },
  {
    name: "Network",
    package: "@capacitor/network",
    version: "5.0.5",
    status: "ok",
    icon: Wifi,
    perms: [],
  },
  {
    name: "Share",
    package: "@capacitor/share",
    version: "2.0.2",
    status: "outdated",
    icon: Share2,
    perms: [],
  },
  {
    name: "Preferences",
    package: "@capacitor/preferences",
    version: "5.0.7",
    status: "ok",
    icon: HardDrive,
    perms: [],
  },
  {
    name: "Filesystem",
    package: "@capacitor/filesystem",
    version: "5.2.1",
    status: "ok",
    icon: Layers,
    perms: ["READ_EXTERNAL_STORAGE"],
  },
];

const pluginStatusColor: Record<string, string> = {
  ok: "text-success",
  warn: "text-warning",
  outdated: "text-info",
};
const pluginStatusLabel: Record<string, string> = {
  ok: "Registered",
  warn: "Config Issue",
  outdated: "Update Available",
};
</script>

<template>
  <div class="flex-1 overflow-y-auto p-4">
    <div class="max-w-2xl space-y-2">
      <div
        v-for="plugin in plugins"
        :key="plugin.name"
        class="flex items-center gap-3 p-3 border border-border bg-accent transition-all group"
      >
        <div
          class="w-9 h-9 rounded-lg bg-secondary border border-border flex items-center justify-center shrink-0"
        >
          <component :is="plugin.icon" class="w-4 h-4 text-foreground" />
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <span class="text-xs font-medium text-foreground">{{ plugin.name }}</span>
            <span class="text-2xs font-medium" :class="pluginStatusColor[plugin.status]">
              {{ pluginStatusLabel[plugin.status] }}
            </span>
          </div>
          <div class="text-2xs font-mono text-muted-foreground mt-0.5">
            {{ plugin.package }} · v{{ plugin.version }}
          </div>
          <div v-if="plugin.perms.length > 0" class="flex gap-1 mt-1.5 flex-wrap">
            <span
              v-for="perm in plugin.perms"
              :key="perm"
              class="text-2xs font-mono px-1.5 py-0.5 rounded bg-secondary text-muted-foreground border border-border"
            >
              {{ perm }}
            </span>
          </div>
        </div>
        <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            v-if="plugin.status === 'outdated'"
            variant="outline"
            size="sm"
            class="text-2xs gap-1 bg-info/10 text-info border-info/20 hover:bg-info/20"
          >
            <ArrowUpRight class="w-2.5 h-2.5" />
            Update
          </Button>
          <Button variant="ghost" size="sm" class="text-2xs gap-1">
            <ChevronRight class="w-3 h-3" />
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>
