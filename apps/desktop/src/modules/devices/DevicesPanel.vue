<script setup lang="ts">
import { ref } from "vue";
import {
  Battery,
  Wifi,
  Usb,
  Monitor,
  Circle,
  Smartphone,
  HardDrive,
  Cpu,
  Search,
  Trash2,
  StopCircle,
  Download,
  ScreenShare,
  FolderOpen,
} from "lucide-vue-next";
import PanelHeader from "@/components/layout/PanelHeader.vue";
import { devices, logcatMessages, packages } from "@/data/mock-data";

type Tab = "info" | "logcat" | "apps" | "files" | "screen";

const selectedDevice = ref(0);
const tab = ref<Tab>("info");
const logFilter = ref("");

const tabs: { id: Tab; label: string }[] = [
  { id: "info", label: "Info" },
  { id: "logcat", label: "Logcat" },
  { id: "apps", label: "Packages" },
  { id: "files", label: "Files" },
  { id: "screen", label: "Screen" },
];

const device = ref(devices[0]);

function selectDevice(i: number) {
  selectedDevice.value = i;
  device.value = devices[i];
}

const logLevelColor: Record<string, string> = {
  V: "text-muted-foreground",
  D: "text-secondary-foreground",
  I: "text-success",
  W: "text-warning",
  E: "text-error",
  F: "text-error font-bold",
};

const logLevelBg: Record<string, string> = {
  E: "bg-error/[0.03]",
  W: "bg-warning/[0.03]",
  F: "bg-error/[0.06]",
};
</script>

<template>
  <div class="flex h-full overflow-hidden">
    <!-- Device list sidebar -->
    <div class="w-56 border-r border-border/30 bg-surface-1 flex flex-col shrink-0">
      <div class="h-10 flex items-center px-3 border-b border-border/20">
        <span class="text-2xs font-medium text-muted-foreground uppercase tracking-[0.08em]"
          >Devices</span
        >
        <span class="ml-auto text-2xs font-mono text-muted-foreground">
          {{ devices.filter((d) => d.status === "online").length }}/{{ devices.length }}
        </span>
      </div>

      <div class="flex-1 overflow-y-auto p-1.5 space-y-0.5">
        <button
          v-for="(d, i) in devices"
          :key="d.id"
          @click="selectDevice(i)"
          class="w-full text-left px-2.5 py-2 rounded-lg transition-all duration-150"
          :class="
            selectedDevice === i
              ? 'bg-surface-3 border border-border/40'
              : 'border border-transparent hover:bg-surface-2'
          "
        >
          <div class="flex items-center gap-2">
            <div
              class="w-1.5 h-1.5 rounded-full shrink-0"
              :class="d.status === 'online' ? 'bg-success glow-dot' : 'bg-muted-foreground/40'"
            />
            <span class="text-xs font-medium text-foreground truncate">{{ d.model }}</span>
          </div>
          <div class="flex items-center gap-1.5 mt-1 ml-3.5">
            <span class="text-2xs font-mono text-dimmed">{{ d.id.slice(0, 10) }}…</span>
            <span class="text-2xs text-dimmed">·</span>
            <span
              class="text-2xs"
              :class="
                d.connection === 'USB'
                  ? 'text-success/60'
                  : d.connection === 'WiFi'
                    ? 'text-info/60'
                    : 'text-warning/60'
              "
              >{{ d.connection }}</span
            >
          </div>
        </button>
      </div>
    </div>

    <!-- Content area -->
    <div class="flex-1 flex flex-col overflow-hidden">
      <PanelHeader
        :title="device.model"
        :subtitle="`API ${device.apiLevel} · Android ${device.androidVersion}`"
      />

      <!-- Tab bar -->
      <div class="h-10 border-b border-border/20 bg-surface-1 flex items-center px-1 shrink-0">
        <button
          v-for="t in tabs"
          :key="t.id"
          @click="tab = t.id"
          class="relative px-3 py-2 text-xs transition-colors duration-150"
          :class="
            tab === t.id
              ? 'text-foreground'
              : 'text-muted-foreground hover:text-secondary-foreground'
          "
        >
          {{ t.label }}
          <div
            v-if="tab === t.id"
            class="absolute bottom-0 left-1 right-1 h-[2px] bg-primary rounded-full"
          />
        </button>
      </div>

      <!-- Info tab -->
      <div v-if="tab === 'info'" class="flex-1 overflow-y-auto p-5">
        <div class="grid grid-cols-3 gap-2.5 max-w-3xl">
          <div
            v-for="item in [
              { icon: Smartphone, label: 'Model', value: device.model, color: 'text-primary' },
              { icon: Monitor, label: 'Display', value: device.resolution, color: 'text-info' },
              { icon: Cpu, label: 'Processor', value: device.cpu, color: 'text-warning' },
              { icon: HardDrive, label: 'Storage', value: device.storage, color: 'text-success' },
              {
                icon: Battery,
                label: 'Battery',
                value: `${device.battery}%`,
                color: device.battery > 50 ? 'text-success' : 'text-warning',
              },
              {
                icon: Wifi,
                label: 'Connection',
                value: `${device.connection} · ${device.ip}`,
                color: 'text-info',
              },
            ]"
            :key="item.label"
            class="bg-surface-2/60 rounded-lg p-3 border border-border/20 hover:border-border/40 transition-colors"
          >
            <div class="flex items-center gap-2 mb-2">
              <div
                class="w-6 h-6 rounded-md bg-surface-3 flex items-center justify-center"
                :class="item.color"
              >
                <component :is="item.icon" class="w-3 h-3" />
              </div>
              <span class="text-2xs text-muted-foreground uppercase tracking-wider">{{
                item.label
              }}</span>
            </div>
            <span class="text-xs font-medium text-foreground">{{ item.value }}</span>
          </div>
        </div>

        <div class="mt-5 max-w-3xl">
          <span class="text-2xs text-muted-foreground uppercase tracking-wider">Quick Actions</span>
          <div class="flex gap-2 mt-2">
            <button
              v-for="action in [
                { icon: ScreenShare, label: 'Screenshot' },
                { icon: FolderOpen, label: 'File Explorer' },
                { icon: Wifi, label: 'Wireless Debug' },
              ]"
              :key="action.label"
              class="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-2/40 border border-border/20 text-xs text-secondary-foreground hover:text-foreground hover:border-border/40 transition-all"
            >
              <component :is="action.icon" class="w-3.5 h-3.5" />
              {{ action.label }}
            </button>
          </div>
        </div>
      </div>

      <!-- Logcat tab -->
      <div v-else-if="tab === 'logcat'" class="flex-1 flex flex-col overflow-hidden">
        <div
          class="h-8 border-b border-border/20 bg-surface-2/40 flex items-center px-3 gap-2 shrink-0"
        >
          <Search class="w-3 h-3 text-muted-foreground" />
          <input
            v-model="logFilter"
            class="bg-transparent text-2xs text-foreground flex-1 outline-none placeholder:text-dimmed font-mono"
            placeholder="Filter…"
          />
          <div class="flex gap-0.5">
            <button
              v-for="lvl in ['V', 'D', 'I', 'W', 'E']"
              :key="lvl"
              class="text-2xs font-mono w-5 h-5 flex items-center justify-center rounded hover:bg-surface-3 transition-colors"
              :class="logLevelColor[lvl]"
            >
              {{ lvl }}
            </button>
          </div>
        </div>
        <div class="flex-1 overflow-y-auto bg-surface-0/50 font-mono text-2xs leading-[18px]">
          <div
            v-for="(msg, i) in logcatMessages.filter(
              (m) =>
                !logFilter ||
                m.message.toLowerCase().includes(logFilter.toLowerCase()) ||
                m.tag.toLowerCase().includes(logFilter.toLowerCase()),
            )"
            :key="i"
            class="flex gap-0 px-3 py-[3px] data-row"
            :class="logLevelBg[msg.level] || ''"
          >
            <span class="w-3 shrink-0 font-bold" :class="logLevelColor[msg.level]">{{
              msg.level
            }}</span>
            <span class="w-24 shrink-0 text-dimmed truncate px-2">{{ msg.tag }}</span>
            <span class="w-10 shrink-0 text-dimmed text-right pr-3">{{ msg.pid }}</span>
            <span
              class="flex-1"
              :class="msg.level === 'E' ? 'text-error' : 'text-secondary-foreground'"
              >{{ msg.message }}</span
            >
          </div>
        </div>
      </div>

      <!-- Packages tab -->
      <div v-else-if="tab === 'apps'" class="flex-1 overflow-auto">
        <table class="w-full text-2xs">
          <thead>
            <tr
              class="text-left text-dimmed uppercase tracking-wider border-b border-border/20 bg-surface-2/30"
            >
              <th class="px-4 py-2 font-medium">Package</th>
              <th class="px-4 py-2 font-medium">Version</th>
              <th class="px-4 py-2 font-medium">Size</th>
              <th class="px-4 py-2 font-medium">Installed</th>
              <th class="px-4 py-2 font-medium w-24"></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="pkg in packages"
              :key="pkg.name"
              class="border-b border-border/10 data-row group"
            >
              <td class="px-4 py-2.5 font-mono text-foreground text-xs">{{ pkg.name }}</td>
              <td class="px-4 py-2.5 text-muted-foreground font-mono">{{ pkg.version }}</td>
              <td class="px-4 py-2.5 text-muted-foreground">{{ pkg.size }}</td>
              <td class="px-4 py-2.5 text-muted-foreground">{{ pkg.installDate }}</td>
              <td class="px-4 py-2.5">
                <div class="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    title="Force Stop"
                    class="p-1 rounded text-dimmed hover:text-warning hover:bg-surface-3 transition-colors"
                  >
                    <StopCircle class="w-3 h-3" />
                  </button>
                  <button
                    title="Pull APK"
                    class="p-1 rounded text-dimmed hover:text-foreground hover:bg-surface-3 transition-colors"
                  >
                    <Download class="w-3 h-3" />
                  </button>
                  <button
                    title="Uninstall"
                    class="p-1 rounded text-dimmed hover:text-error hover:bg-surface-3 transition-colors"
                  >
                    <Trash2 class="w-3 h-3" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Files / Screen placeholder -->
      <div v-else class="flex-1 flex items-center justify-center">
        <div class="text-center">
          <div
            class="w-10 h-10 rounded-xl bg-surface-3 border border-border/20 flex items-center justify-center mx-auto mb-3"
          >
            <component
              :is="tab === 'files' ? FolderOpen : ScreenShare"
              class="w-5 h-5 text-muted-foreground"
            />
          </div>
          <p class="text-xs text-muted-foreground">
            {{ tab === "files" ? "File Explorer" : "Screen Capture" }}
          </p>
          <p class="text-2xs text-dimmed mt-1">Connect a device to access</p>
        </div>
      </div>
    </div>
  </div>
</template>
