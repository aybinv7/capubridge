<script setup lang="ts">
import { ref, computed } from "vue";
import {
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  RotateCcw,
  Trash2,
  Camera,
  Bell,
  Map,
  Fingerprint,
  Wifi,
  Share2,
  HardDrive,
  Layers,
  ArrowUpRight,
  GitBranch,
  Play,
  Database,
  Archive,
  FolderOpen,
} from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  syncQueueRecords,
  mockDatabases,
  mockLocalStorageOrigins,
  mockCacheAPIOrigins,
  mockOPFSEntries,
} from "@/data/mock-data";

const syncRecords = ref(syncQueueRecords.map((r) => ({ ...r })));

const syncStats = computed(() => ({
  pending: syncRecords.value.filter((r) => r.status === "pending").length,
  failed: syncRecords.value.filter((r) => r.status === "failed").length,
  synced: syncRecords.value.filter((r) => r.status === "synced").length,
}));

const syncTypeColor: Record<string, string> = {
  CREATE: "text-success bg-success/10 border-success/20",
  UPDATE: "text-info bg-info/10 border-info/20",
  DELETE: "text-error bg-error/10 border-error/20",
};

const syncStatusIcon: Record<string, typeof Clock> = {
  pending: Clock,
  failed: XCircle,
  synced: CheckCircle,
};

const syncStatusColor: Record<string, string> = {
  pending: "text-warning",
  failed: "text-error",
  synced: "text-success",
};

const plugins = [
  {
    name: "Camera",
    package: "@capacitor/camera",
    version: "5.0.9",
    status: "ok" as const,
    icon: Camera,
  },
  {
    name: "Push Notifications",
    package: "@capacitor/push-notifications",
    version: "5.1.2",
    status: "ok" as const,
    icon: Bell,
  },
  {
    name: "Geolocation",
    package: "@capacitor/geolocation",
    version: "5.0.7",
    status: "ok" as const,
    icon: Map,
  },
  {
    name: "Biometrics",
    package: "capacitor-biometric-auth",
    version: "5.1.0",
    status: "warn" as const,
    icon: Fingerprint,
  },
  {
    name: "Network",
    package: "@capacitor/network",
    version: "5.0.5",
    status: "ok" as const,
    icon: Wifi,
  },
  {
    name: "Share",
    package: "@capacitor/share",
    version: "2.0.2",
    status: "outdated" as const,
    icon: Share2,
  },
  {
    name: "Preferences",
    package: "@capacitor/preferences",
    version: "5.0.7",
    status: "ok" as const,
    icon: HardDrive,
  },
  {
    name: "Filesystem",
    package: "@capacitor/filesystem",
    version: "5.2.1",
    status: "ok" as const,
    icon: Layers,
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

const migrations = [
  {
    id: "M001",
    name: "init_schema",
    db: "appDatabase",
    version: 1,
    status: "applied" as const,
    ts: "2024-01-15",
    duration: "12ms",
  },
  {
    id: "M002",
    name: "add_sync_queue",
    db: "appDatabase",
    version: 2,
    status: "applied" as const,
    ts: "2024-02-01",
    duration: "8ms",
  },
  {
    id: "M003",
    name: "add_offline_cache",
    db: "appDatabase",
    version: 3,
    status: "applied" as const,
    ts: "2024-03-01",
    duration: "45ms",
  },
  {
    id: "M004",
    name: "add_user_preferences",
    db: "jeep-sqlite",
    version: 1,
    status: "applied" as const,
    ts: "2024-03-10",
    duration: "5ms",
  },
  {
    id: "M005",
    name: "add_metadata_index",
    db: "appDatabase",
    version: 4,
    status: "pending" as const,
    ts: "—",
    duration: "—",
  },
  {
    id: "M006",
    name: "normalize_timestamps",
    db: "appDatabase",
    version: 5,
    status: "pending" as const,
    ts: "—",
    duration: "—",
  },
];

const totalKeys = mockLocalStorageOrigins.reduce((sum, o) => sum + o.entries.length, 0);
const totalCacheEntries = mockCacheAPIOrigins.reduce(
  (sum, o) => sum + o.caches.reduce((s, c) => s + c.entries.length, 0),
  0,
);
</script>

<template>
  <div class="flex-1 overflow-y-auto p-4">
    <div class="max-w-6xl mx-auto space-y-4">
      <!-- ── Sync Queue ──────────────────────────────────────────── -->
      <div class="border border-border bg-accent overflow-hidden">
        <div class="flex items-center justify-between px-4 py-2.5 border-b border-border">
          <div class="flex items-center gap-2">
            <RefreshCw class="w-4 h-4 text-muted-foreground" />
            <h3 class="text-sm font-medium text-foreground">Sync Queue</h3>
          </div>
          <div class="flex items-center gap-2">
            <Badge variant="outline" class="text-2xs text-warning border-warning/20 bg-warning/5">
              {{ syncStats.pending }} pending
            </Badge>
            <Badge variant="outline" class="text-2xs text-error border-error/20 bg-error/5">
              {{ syncStats.failed }} failed
            </Badge>
            <Badge variant="outline" class="text-2xs text-success border-success/20 bg-success/5">
              {{ syncStats.synced }} synced
            </Badge>
            <Button variant="ghost" size="sm" class="h-6 text-2xs gap-1 ml-1">
              <RefreshCw class="w-3 h-3" />
              Flush
            </Button>
          </div>
        </div>
        <div class="divide-y divide-border">
          <div
            v-for="record in syncRecords"
            :key="record.id"
            class="flex items-center gap-3 px-4 py-2"
            :class="
              record.status === 'failed'
                ? 'bg-error/[0.02]'
                : record.status === 'synced'
                  ? 'opacity-50'
                  : ''
            "
          >
            <component
              :is="syncStatusIcon[record.status]"
              class="w-3.5 h-3.5 shrink-0"
              :class="syncStatusColor[record.status]"
            />
            <span
              class="text-2xs font-mono font-medium px-1.5 py-0.5 rounded border shrink-0"
              :class="syncTypeColor[record.type]"
            >
              {{ record.type }}
            </span>
            <span class="text-xs text-foreground font-medium">{{ record.entity }}</span>
            <span class="text-2xs font-mono text-muted-foreground">{{ record.entityId }}</span>
            <span class="ml-auto text-2xs font-mono text-muted-foreground">{{
              record.timestamp.slice(11, 19)
            }}</span>
            <div v-if="record.retries > 0" class="flex items-center gap-1">
              <AlertTriangle class="w-2.5 h-2.5 text-error" />
              <span class="text-2xs text-error">{{ record.retries }}×</span>
            </div>
            <div v-if="record.status === 'failed'" class="flex gap-0.5">
              <Button
                variant="ghost"
                size="icon-sm"
                class="w-5 h-5 text-muted-foreground hover:text-warning"
              >
                <RotateCcw class="w-3 h-3" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Plugins + Migrations side by side ──────────────────── -->
      <div class="grid grid-cols-2 gap-4">
        <!-- Plugins -->
        <div class="border border-border bg-accent overflow-hidden">
          <div class="flex items-center justify-between px-4 py-2.5 border-b border-border">
            <div class="flex items-center gap-2">
              <Layers class="w-4 h-4 text-muted-foreground" />
              <h3 class="text-sm font-medium text-foreground">Plugins</h3>
            </div>
            <span class="text-2xs text-muted-foreground">{{ plugins.length }} installed</span>
          </div>
          <div class="divide-y divide-border">
            <div
              v-for="plugin in plugins"
              :key="plugin.name"
              class="flex items-center gap-2.5 px-4 py-2"
            >
              <div
                class="w-6 h-6 rounded-md bg-secondary border border-border flex items-center justify-center shrink-0"
              >
                <component :is="plugin.icon" class="w-3 h-3 text-muted-foreground" />
              </div>
              <div class="flex-1 min-w-0">
                <div class="text-xs text-foreground truncate">{{ plugin.name }}</div>
                <div class="text-2xs font-mono text-muted-foreground">v{{ plugin.version }}</div>
              </div>
              <span class="text-2xs font-medium" :class="pluginStatusColor[plugin.status]">
                {{ pluginStatusLabel[plugin.status] }}
              </span>
              <Button
                v-if="plugin.status === 'outdated'"
                variant="outline"
                size="sm"
                class="h-6 text-2xs gap-1 bg-info/10 text-info border-info/20"
              >
                <ArrowUpRight class="w-2.5 h-2.5" />
                Update
              </Button>
            </div>
          </div>
        </div>

        <!-- Migrations -->
        <div class="border border-border bg-accent overflow-hidden">
          <div class="flex items-center justify-between px-4 py-2.5 border-b border-border">
            <div class="flex items-center gap-2">
              <GitBranch class="w-4 h-4 text-muted-foreground" />
              <h3 class="text-sm font-medium text-foreground">Migrations</h3>
            </div>
            <Button
              variant="outline"
              size="sm"
              class="h-6 text-2xs gap-1 bg-secondary text-foreground border-border"
            >
              <Play class="w-3 h-3" />
              Run pending
            </Button>
          </div>
          <div class="divide-y divide-border">
            <div
              v-for="m in migrations"
              :key="m.id"
              class="flex items-center gap-2.5 px-4 py-2"
              :class="m.status === 'pending' ? '' : 'opacity-60'"
            >
              <CheckCircle
                v-if="m.status === 'applied'"
                class="w-3.5 h-3.5 text-success shrink-0"
              />
              <Clock v-else class="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span class="text-2xs font-mono text-muted-foreground w-10">{{ m.id }}</span>
              <span class="text-xs text-foreground flex-1 truncate">{{ m.name }}</span>
              <span class="text-2xs font-mono text-muted-foreground">{{ m.db }}</span>
              <span class="text-2xs font-mono text-muted-foreground">v{{ m.version }}</span>
              <span
                class="text-2xs font-medium"
                :class="m.status === 'applied' ? 'text-success' : 'text-muted-foreground'"
              >
                {{ m.status }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Storage Overview ───────────────────────────────────── -->
      <div class="border border-border bg-accent overflow-hidden">
        <div class="flex items-center justify-between px-4 py-2.5 border-b border-border">
          <div class="flex items-center gap-2">
            <HardDrive class="w-4 h-4 text-muted-foreground" />
            <h3 class="text-sm font-medium text-foreground">Storage Overview</h3>
          </div>
        </div>
        <div class="grid grid-cols-4 divide-x divide-border">
          <div class="flex flex-col items-center justify-center py-5">
            <Database class="w-5 h-5 text-muted-foreground mb-2" />
            <span class="text-lg font-bold font-mono text-foreground">{{
              mockDatabases.length
            }}</span>
            <span class="text-2xs text-muted-foreground">IndexedDB</span>
            <span class="text-2xs text-muted-foreground font-mono mt-0.5"
              >{{ mockDatabases.reduce((s, d) => s + d.stores.length, 0) }} stores</span
            >
          </div>
          <div class="flex flex-col items-center justify-center py-5">
            <HardDrive class="w-5 h-5 text-info/40 mb-2" />
            <span class="text-lg font-bold font-mono text-foreground">{{ totalKeys }}</span>
            <span class="text-2xs text-muted-foreground">LocalStorage</span>
            <span class="text-2xs text-muted-foreground font-mono mt-0.5"
              >{{ mockLocalStorageOrigins.length }} origins</span
            >
          </div>
          <div class="flex flex-col items-center justify-center py-5">
            <Archive class="w-5 h-5 text-warning/40 mb-2" />
            <span class="text-lg font-bold font-mono text-foreground">{{ totalCacheEntries }}</span>
            <span class="text-2xs text-muted-foreground">Cache API</span>
            <span class="text-2xs text-muted-foreground font-mono mt-0.5"
              >{{ mockCacheAPIOrigins.length }} origins</span
            >
          </div>
          <div class="flex flex-col items-center justify-center py-5">
            <FolderOpen class="w-5 h-5 text-success/40 mb-2" />
            <span class="text-lg font-bold font-mono text-foreground">{{
              mockOPFSEntries.length
            }}</span>
            <span class="text-2xs text-muted-foreground">OPFS</span>
            <span class="text-2xs text-muted-foreground font-mono mt-0.5"
              >{{ mockOPFSEntries.filter((e) => e.type !== "directory").length }} files</span
            >
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
