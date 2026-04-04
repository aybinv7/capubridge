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
    <div class="h-11 shrink-0 border-b border-border/30 bg-surface-2 flex items-center px-4 gap-3">
      <div class="flex items-center gap-2 max-w-sm flex-1">
        <Search class="w-4 h-4 text-muted-foreground/50 shrink-0" />
        <Input
          v-model="appsSearch"
          class="h-8 text-sm bg-transparent border border-border/30 rounded-md px-3 focus-visible:ring-0 focus-visible:border-border/60 placeholder:text-muted-foreground/40"
          placeholder="Search apps…"
        />
      </div>
      <div class="w-px h-5 bg-border/30" />
      <div class="flex gap-1">
        <Button
          v-for="cat in categories"
          :key="cat"
          :variant="appsCategory === cat ? 'secondary' : 'ghost'"
          size="sm"
          class="h-7 px-3 text-xs"
          :class="appsCategory === cat ? '' : 'text-muted-foreground/50'"
          @click="appsCategory = cat"
        >
          {{ cat }}
        </Button>
      </div>
      <div class="flex-1" />
      <div class="flex gap-0.5 p-0.5 bg-surface-3 rounded-md border border-border/30">
        <Button
          :variant="appsView === 'grid' ? 'secondary' : 'ghost'"
          size="icon-sm"
          class="w-7 h-7"
          @click="appsView = 'grid'"
        >
          <LayoutGrid class="w-3.5 h-3.5" />
        </Button>
        <Button
          :variant="appsView === 'table' ? 'secondary' : 'ghost'"
          size="icon-sm"
          class="w-7 h-7"
          @click="appsView = 'table'"
        >
          <List class="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>

    <!-- Resizable panels: content | detail -->
    <ResizablePanelGroup direction="horizontal" class="flex-1">
      <ResizablePanel :default-size="75" :min-size="60">
        <!-- Grid view -->
        <div v-if="appsView === 'grid'" class="h-full overflow-y-auto p-6">
          <div
            class="grid gap-3"
            style="grid-template-columns: repeat(auto-fill, minmax(150px, 1fr))"
          >
            <Button
              v-for="app in filteredApps"
              :key="app.id"
              variant="ghost"
              class="flex flex-col items-center gap-3 p-4 border border-border/30 rounded-lg transition-all text-center h-auto"
              :class="
                selectedApp?.id === app.id
                  ? 'border-border/60 bg-surface-3'
                  : 'hover:bg-surface-3/50 hover:border-border/40'
              "
              @click="selectedApp = selectedApp?.id === app.id ? null : app"
            >
              <div
                class="w-14 h-14 flex items-center justify-center text-white font-bold text-xl shrink-0"
                :style="{ backgroundColor: app.color }"
              >
                {{ app.label.charAt(0) }}
              </div>
              <div class="w-full">
                <div class="text-sm font-medium text-foreground truncate">{{ app.label }}</div>
                <div class="text-xs text-muted-foreground/50 mt-0.5">v{{ app.version }}</div>
                <div class="text-xs text-muted-foreground/40 mt-0.5">{{ app.size }}</div>
              </div>
            </Button>
          </div>
        </div>

        <!-- Table view -->
        <div v-else class="h-full overflow-auto">
          <table class="w-full text-xs">
            <thead class="sticky top-0 z-10">
              <tr
                class="bg-surface-2 text-left text-muted-foreground/50 uppercase tracking-wider border-b border-border/30"
              >
                <th class="px-4 py-2.5 font-medium w-10"></th>
                <th class="px-4 py-2.5 font-medium">App</th>
                <th class="px-4 py-2.5 font-medium">Package</th>
                <th class="px-4 py-2.5 font-medium">Version</th>
                <th class="px-4 py-2.5 font-medium">Size</th>
                <th class="px-4 py-2.5 font-medium">Category</th>
                <th class="px-4 py-2.5 font-medium w-28"></th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="app in filteredApps"
                :key="app.id"
                @click="selectedApp = selectedApp?.id === app.id ? null : app"
                class="border-b border-border/20 cursor-pointer transition-colors group"
                :class="selectedApp?.id === app.id ? 'bg-surface-3' : 'data-row'"
              >
                <td class="px-4 py-2.5">
                  <div
                    class="w-8 h-8 flex items-center justify-center text-white font-bold text-xs"
                    :style="{ backgroundColor: app.color }"
                  >
                    {{ app.label.charAt(0) }}
                  </div>
                </td>
                <td class="px-4 py-2.5 text-sm font-medium text-foreground">{{ app.label }}</td>
                <td class="px-4 py-2.5 font-mono text-muted-foreground/60">
                  {{ app.packageName }}
                </td>
                <td class="px-4 py-2.5 font-mono text-muted-foreground/60">{{ app.version }}</td>
                <td class="px-4 py-2.5 text-muted-foreground/60">{{ app.size }}</td>
                <td class="px-4 py-2.5 text-muted-foreground/60">{{ app.category }}</td>
                <td class="px-4 py-2.5">
                  <div class="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Force Stop"
                      class="text-muted-foreground/40 hover:text-warning h-7 w-7"
                    >
                      <StopCircle class="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Pull APK"
                      class="text-muted-foreground/40 hover:text-foreground h-7 w-7"
                    >
                      <Download class="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Uninstall"
                      class="text-muted-foreground/40 hover:text-error h-7 w-7"
                    >
                      <Trash2 class="w-3.5 h-3.5" />
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
              class="h-11 flex items-center justify-between px-4 border-b border-border/30 shrink-0"
            >
              <span class="text-sm font-medium text-foreground truncate">{{
                selectedApp.label
              }}</span>
              <Button
                variant="ghost"
                size="icon-sm"
                class="text-muted-foreground/50 ml-2"
                @click="selectedApp = null"
              >
                <X class="w-3.5 h-3.5" />
              </Button>
            </div>
            <ScrollArea class="flex-1">
              <div class="p-5 space-y-5">
                <div class="flex flex-col items-center py-4">
                  <div
                    class="w-20 h-20 flex items-center justify-center text-white font-bold text-3xl mb-3"
                    :style="{ backgroundColor: selectedApp.color }"
                  >
                    {{ selectedApp.label.charAt(0) }}
                  </div>
                  <div class="text-base font-semibold text-foreground">{{ selectedApp.label }}</div>
                  <div class="text-xs text-muted-foreground/50 font-mono mt-1">
                    {{ selectedApp.packageName }}
                  </div>
                </div>
                <div class="grid grid-cols-2 gap-2">
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
                    class="bg-surface-2 border border-border/30 rounded-lg p-3"
                  >
                    <div class="text-xs text-muted-foreground/50 mb-1">{{ stat.label }}</div>
                    <div class="text-sm font-medium text-foreground font-mono">
                      {{ stat.value }}
                    </div>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </template>
          <template v-else>
            <div class="flex-1 flex items-center justify-center text-muted-foreground/30 text-xs">
              Select an app to view details
            </div>
          </template>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  </div>
</template>
