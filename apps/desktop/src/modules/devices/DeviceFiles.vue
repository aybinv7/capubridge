<script setup lang="ts">
import { ref, computed } from "vue";
import {
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Image,
  Film,
  Music,
  Package,
  FileText,
  File,
  Trash2,
  ArrowDown,
  ArrowUp,
} from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { fileTree } from "@/data/mock-data";
import type { FileNode } from "@/data/mock-data";

const expandedDirs = ref<Set<string>>(new Set(["/sdcard", "/sdcard/DCIM"]));
const selectedDir = ref<string>("/sdcard/DCIM/Camera");

function toggleDir(path: string) {
  if (expandedDirs.value.has(path)) {
    expandedDirs.value.delete(path);
  } else {
    expandedDirs.value.add(path);
  }
}

function getFileIcon(ext: string) {
  if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) return Image;
  if (["mp4", "mkv", "mov", "avi"].includes(ext)) return Film;
  if (["mp3", "flac", "wav", "ogg"].includes(ext)) return Music;
  if (ext === "apk") return Package;
  if (["txt", "md", "pdf"].includes(ext)) return FileText;
  return File;
}

type FlatDir = { path: string; name: string; depth: number };

function flattenTree(nodes: FileNode[], prefix = "/sdcard", depth = 0): FlatDir[] {
  const result: FlatDir[] = [];
  for (const n of nodes) {
    if (n.type === "dir") {
      const path = `${prefix}/${n.name}`;
      result.push({ path, name: n.name, depth });
      if (expandedDirs.value.has(path)) {
        result.push(...flattenTree(n.children, path, depth + 1));
      }
    }
  }
  return result;
}

const flatDirs = computed(() => flattenTree(fileTree));

function getFilesInDir(path: string): (FileNode & { type: "file" })[] {
  const parts = path.replace("/sdcard/", "").split("/");
  let nodes: FileNode[] = fileTree;
  for (const part of parts) {
    const dir = nodes.find((n) => n.type === "dir" && n.name === part) as
      | (FileNode & { type: "dir" })
      | undefined;
    if (!dir) return [];
    nodes = dir.children;
  }
  return nodes.filter((n): n is FileNode & { type: "file" } => n.type === "file");
}

const currentFiles = computed(() => getFilesInDir(selectedDir.value));
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <!-- Toolbar -->
    <div class="h-10 border-b border-border/30 bg-surface-2 flex items-center px-4 gap-3 shrink-0">
      <span class="text-sm font-mono text-muted-foreground truncate">{{ selectedDir }}</span>
      <div class="flex-1" />
      <Button variant="outline" size="sm" class="gap-2 text-xs" title="Push file">
        <ArrowUp class="w-3.5 h-3.5" />
        Push
      </Button>
    </div>

    <!-- Resizable panels: tree | files -->
    <ResizablePanelGroup direction="horizontal" class="flex-1">
      <!-- File tree -->
      <ResizablePanel :default-size="15" :min-size="10" :max-size="30">
        <div class="flex h-full flex-col border-r border-border/30">
          <div class="h-9 flex items-center px-3 border-b border-border/30 gap-2">
            <FolderOpen class="w-3.5 h-3.5 text-warning/50" />
            <span class="text-xs font-medium text-muted-foreground">/sdcard</span>
          </div>
          <ScrollArea class="flex-1">
            <div class="py-1 text-xs">
              <Button
                variant="ghost"
                size="sm"
                class="w-full justify-start gap-2 px-3 py-2 h-auto text-muted-foreground"
                :class="selectedDir === '/sdcard' ? 'text-foreground bg-surface-3' : ''"
                @click="selectedDir = '/sdcard'"
              >
                <ChevronRight class="w-3 h-3 opacity-0" />
                <FolderOpen class="w-3.5 h-3.5 text-warning/40" />
                <span>/ (root)</span>
              </Button>

              <template v-for="dir in flatDirs" :key="dir.path">
                <Button
                  variant="ghost"
                  size="sm"
                  class="w-full justify-start gap-2 py-2 h-auto"
                  :style="{ paddingLeft: `${12 + dir.depth * 14}px` }"
                  :class="
                    selectedDir === dir.path
                      ? 'text-foreground bg-surface-3'
                      : 'text-muted-foreground/60 hover:text-muted-foreground hover:bg-surface-3/50'
                  "
                  @click="
                    selectedDir = dir.path;
                    toggleDir(dir.path);
                  "
                >
                  <component
                    :is="expandedDirs.has(dir.path) ? ChevronDown : ChevronRight"
                    class="w-3 h-3 shrink-0 opacity-50"
                  />
                  <FolderOpen class="w-3.5 h-3.5 text-warning/40 shrink-0" />
                  <span class="truncate">{{ dir.name }}</span>
                </Button>
              </template>
            </div>
          </ScrollArea>
        </div>
      </ResizablePanel>
      <ResizableHandle with-handle />

      <!-- Files table -->
      <ResizablePanel :default-size="75">
        <div class="flex-1 overflow-auto h-full">
          <div
            v-if="currentFiles.length === 0"
            class="flex flex-col items-center justify-center h-full text-center"
          >
            <FolderOpen class="w-10 h-10 text-muted-foreground/15 mb-3" />
            <p class="text-sm text-muted-foreground/40">No files in this directory</p>
          </div>
          <table v-else class="w-full text-xs">
            <thead class="sticky top-0 z-10">
              <tr
                class="bg-surface-2 text-left text-muted-foreground/50 uppercase tracking-wider border-b border-border/30"
              >
                <th class="px-4 py-2.5 font-medium">Name</th>
                <th class="px-4 py-2.5 font-medium w-24">Size</th>
                <th class="px-4 py-2.5 font-medium w-40">Modified</th>
                <th class="px-4 py-2.5 font-medium w-24"></th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="file in currentFiles"
                :key="file.name"
                class="border-b border-border/20 data-row group"
              >
                <td class="px-4 py-2.5 flex items-center gap-2.5">
                  <component
                    :is="getFileIcon(file.ext)"
                    class="w-4 h-4 text-muted-foreground/40 shrink-0"
                  />
                  <span class="text-sm text-foreground">{{ file.name }}</span>
                </td>
                <td class="px-4 py-2.5 text-muted-foreground/60 font-mono">{{ file.size }}</td>
                <td class="px-4 py-2.5 text-muted-foreground/60 font-mono">{{ file.modified }}</td>
                <td class="px-4 py-2.5">
                  <div class="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Pull to desktop"
                      class="text-muted-foreground/50 hover:text-foreground h-7 w-7"
                    >
                      <ArrowDown class="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Delete"
                      class="text-muted-foreground/50 hover:text-error h-7 w-7"
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
    </ResizablePanelGroup>
  </div>
</template>
