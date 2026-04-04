<script setup lang="ts">
import { ref, computed } from "vue";
import { Search, LayoutGrid, List, StopCircle, Download, Trash2, X } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { installedApps } from "@/data/mock-data";

const appsView = ref<"grid" | "table">("grid");
const appsSearch = ref("");
const appsCategory = ref("All");
const selectedApp = ref<(typeof installedApps)[0] | null>(null);

const categories = ["All", ...Array.from(new Set(installedApps.map((a) => a.category)))];

const filteredApps = computed(() =>
  installedApps.filter((a) => {
    const q = appsSearch.value.toLowerCase();
    const matchSearch =
      !q || a.label.toLowerCase().includes(q) || a.packageName.toLowerCase().includes(q);
    const matchCat = appsCategory.value === "All" || a.category === appsCategory.value;
    return matchSearch && matchCat;
  }),
);
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <!-- Toolbar -->
    <div class="h-9 shrink-0 border-b border-border/20 bg-surface-1 flex items-center px-3 gap-2">
      <Search class="w-3 h-3 text-muted-foreground shrink-0" />
      <Input
        v-model="appsSearch"
        class="h-6 w-48 text-xs bg-transparent border-0 focus-visible:ring-0 px-0 placeholder:text-dimmed"
        placeholder="Search apps…"
      />
      <div class="w-px h-4 bg-border/40" />
      <div class="flex gap-0.5">
        <Button
          v-for="cat in categories"
          :key="cat"
          :variant="appsCategory === cat ? 'default' : 'ghost'"
          size="sm"
          class="h-6 px-2 text-2xs"
          :class="appsCategory === cat ? '' : 'text-dimmed'"
          @click="appsCategory = cat"
        >
          {{ cat }}
        </Button>
      </div>
      <div class="flex-1" />
      <div class="flex gap-0.5 p-0.5 bg-surface-3 rounded-md border border-border/20">
        <Button
          :variant="appsView === 'grid' ? 'secondary' : 'ghost'"
          size="icon-sm"
          class="w-6 h-6"
          @click="appsView = 'grid'"
        >
          <LayoutGrid class="w-3 h-3" />
        </Button>
        <Button
          :variant="appsView === 'table' ? 'secondary' : 'ghost'"
          size="icon-sm"
          class="w-6 h-6"
          @click="appsView = 'table'"
        >
          <List class="w-3 h-3" />
        </Button>
      </div>
    </div>

    <!-- Resizable panels: content | detail -->
    <ResizablePanelGroup direction="horizontal" class="flex-1">
      <ResizablePanel :default-size="75" :min-size="60">
        <!-- Grid view -->
        <div v-if="appsView === 'grid'" class="h-full overflow-y-auto p-4">
          <div
            class="grid gap-3"
            style="grid-template-columns: repeat(auto-fill, minmax(140px, 1fr))"
          >
            <Button
              v-for="app in filteredApps"
              :key="app.id"
              variant="ghost"
              class="flex flex-col items-center gap-2.5 p-3 rounded-xl border transition-all text-center h-auto"
              :class="
                selectedApp?.id === app.id
                  ? 'border-primary/30 bg-primary/[0.06]'
                  : 'border-border/20 bg-surface-2/40 hover:border-border/40 hover:bg-surface-2/70'
              "
              @click="selectedApp = selectedApp?.id === app.id ? null : app"
            >
              <div
                class="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg shrink-0"
                :style="{ backgroundColor: app.color }"
              >
                {{ app.label.charAt(0) }}
              </div>
              <div class="w-full">
                <div class="text-xs font-medium text-foreground truncate">{{ app.label }}</div>
                <div class="text-2xs text-dimmed mt-0.5">v{{ app.version }}</div>
                <div class="text-2xs text-muted-foreground mt-0.5">{{ app.size }}</div>
              </div>
            </Button>
          </div>
        </div>

        <!-- Table view -->
        <div v-else class="h-full overflow-auto">
          <table class="w-full text-2xs">
            <thead class="sticky top-0 z-10">
              <tr
                class="bg-surface-2/80 backdrop-blur-sm text-left text-dimmed uppercase tracking-wider border-b border-border/20"
              >
                <th class="px-3 py-2 font-medium w-8"></th>
                <th class="px-3 py-2 font-medium">App</th>
                <th class="px-3 py-2 font-medium">Package</th>
                <th class="px-3 py-2 font-medium">Version</th>
                <th class="px-3 py-2 font-medium">Size</th>
                <th class="px-3 py-2 font-medium">Category</th>
                <th class="px-3 py-2 font-medium w-24"></th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="app in filteredApps"
                :key="app.id"
                @click="selectedApp = selectedApp?.id === app.id ? null : app"
                class="border-b border-border/10 cursor-pointer transition-colors group"
                :class="selectedApp?.id === app.id ? 'bg-primary/[0.04]' : 'data-row'"
              >
                <td class="px-3 py-2">
                  <div
                    class="w-6 h-6 rounded-md flex items-center justify-center text-white font-bold text-2xs"
                    :style="{ backgroundColor: app.color }"
                  >
                    {{ app.label.charAt(0) }}
                  </div>
                </td>
                <td class="px-3 py-2 text-xs font-medium text-foreground">{{ app.label }}</td>
                <td class="px-3 py-2 font-mono text-muted-foreground">{{ app.packageName }}</td>
                <td class="px-3 py-2 font-mono text-muted-foreground">{{ app.version }}</td>
                <td class="px-3 py-2 text-muted-foreground">{{ app.size }}</td>
                <td class="px-3 py-2 text-muted-foreground">{{ app.category }}</td>
                <td class="px-3 py-2">
                  <div class="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title="Force Stop"
                      class="text-dimmed hover:text-warning"
                    >
                      <StopCircle class="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title="Pull APK"
                      class="text-dimmed hover:text-foreground"
                    >
                      <Download class="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title="Uninstall"
                      class="text-dimmed hover:text-error"
                    >
                      <Trash2 class="w-3 h-3" />
                    </Button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </ResizablePanel>

      <ResizableHandle />
      <ResizablePanel :default-size="25" :min-size="20" :max-size="40">
        <div class="flex h-full flex-col border-l border-border/30 bg-surface-1">
          <template v-if="selectedApp">
            <div
              class="h-10 flex items-center justify-between px-3 border-b border-border/20 shrink-0"
            >
              <span class="text-xs font-medium text-foreground truncate">{{
                selectedApp.label
              }}</span>
              <Button
                variant="ghost"
                size="icon-sm"
                class="text-dimmed ml-2"
                @click="selectedApp = null"
              >
                <X class="w-3 h-3" />
              </Button>
            </div>
            <ScrollArea class="flex-1">
              <div class="p-3 space-y-4">
                <div class="flex flex-col items-center py-3">
                  <div
                    class="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-2xl mb-2.5"
                    :style="{ backgroundColor: selectedApp.color }"
                  >
                    {{ selectedApp.label.charAt(0) }}
                  </div>
                  <div class="text-sm font-semibold text-foreground">{{ selectedApp.label }}</div>
                  <div class="text-2xs text-dimmed font-mono mt-0.5">
                    {{ selectedApp.packageName }}
                  </div>
                </div>
                <div class="grid grid-cols-2 gap-1.5">
                  <div
                    v-for="stat in [
                      { label: 'Version', value: selectedApp.version },
                      { label: 'Size', value: selectedApp.size },
                      { label: 'Target SDK', value: String(selectedApp.targetSdk) },
                      { label: 'Min SDK', value: String(selectedApp.minSdk) },
                      { label: 'Activities', value: String(selectedApp.activities) },
                      { label: 'Services', value: String(selectedApp.services) },
                    ]"
                    :key="stat.label"
                    class="bg-surface-2/60 rounded-lg p-2 border border-border/15"
                  >
                    <div class="text-2xs text-dimmed mb-0.5">{{ stat.label }}</div>
                    <div class="text-xs font-medium text-foreground">{{ stat.value }}</div>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </template>
          <template v-else>
            <div class="flex-1 flex items-center justify-center text-dimmed text-2xs">
              Select an app to view details
            </div>
          </template>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  </div>
</template>
