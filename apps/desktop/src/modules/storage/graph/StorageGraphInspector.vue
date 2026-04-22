<script setup lang="ts">
import { computed, ref, watch } from "vue";
import {
  ArrowRightLeft,
  Database,
  Link2,
  StickyNote,
  TableProperties,
} from "lucide-vue-next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import StorageGraphFieldSettings from "@/modules/storage/graph/StorageGraphFieldSettings.vue";
import type {
  StorageGraphNodeAnnotation,
  StorageGraphNodeData,
  StorageGraphRelationship,
} from "@/types/storageGraph.types";

interface SelectedNodeLike {
  id: string;
  data: StorageGraphNodeData;
}

const props = defineProps<{
  selectedNode: SelectedNodeLike | null;
  selectedEdge: StorageGraphRelationship | null;
}>();

const emit = defineEmits<{
  saveAnnotation: [nodeId: string, annotation: StorageGraphNodeAnnotation];
  saveNote: [
    payload: { id: string; title: string; note: string; accent: string },
  ];
  deleteNote: [noteId: string];
  openNode: [path: string];
  saveEdge: [payload: { id: string; label: string }];
  deleteEdge: [edgeId: string];
}>();

const annotationLabel = ref("");
const annotationNote = ref("");
const noteTitle = ref("");
const noteBody = ref("");
const noteAccent = ref("#e8765a");
const edgeLabel = ref("");

const selectedNodeData = computed(() => props.selectedNode?.data ?? null);
const isNoteNode = computed(() => selectedNodeData.value?.nodeKind === "note");

watch(
  selectedNodeData,
  (value) => {
    if (!value) {
      annotationLabel.value = "";
      annotationNote.value = "";
      noteTitle.value = "";
      noteBody.value = "";
      noteAccent.value = "#e8765a";
      return;
    }

    if (value.nodeKind === "note") {
      noteTitle.value = value.title;
      noteBody.value = value.note;
      noteAccent.value = value.accent;
      return;
    }

    annotationLabel.value = value.annotation?.label ?? "";
    annotationNote.value = value.annotation?.note ?? "";
  },
  { immediate: true },
);

watch(
  () => props.selectedEdge,
  (value) => {
    edgeLabel.value = value?.label ?? "";
  },
  { immediate: true },
);

function saveNode() {
  if (!props.selectedNode || !selectedNodeData.value) {
    return;
  }

  if (selectedNodeData.value.nodeKind === "note") {
    emit("saveNote", {
      id: props.selectedNode.id,
      title: noteTitle.value.trim() || "Note",
      note: noteBody.value,
      accent: noteAccent.value,
    });
    return;
  }

  emit("saveAnnotation", props.selectedNode.id, {
    label: annotationLabel.value.trim() || undefined,
    note: annotationNote.value.trim() || undefined,
    accent: selectedNodeData.value.annotation?.accent,
  });
}
</script>

<template>
  <div
    class="flex h-fit flex-col bg-[linear-gradient(180deg,var(--color-surface-1),var(--color-surface-0))]"
  >
    <div class="min-h-0 flex-1 overflow-auto px-4 py-4">
      <div v-if="selectedNodeData" class="space-y-4">
        <div
          class="overflow-hidden rounded-[28px] border border-border/25 bg-surface-0 shadow-[0_18px_60px_-36px_rgba(0,0,0,0.68)]"
        >
          <div class="border-b border-border/15 px-4 py-4">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <Badge variant="outline" class="gap-1 rounded-full">
                    <component
                      :is="isNoteNode ? StickyNote : Database"
                      :size="12"
                    />
                    {{
                      selectedNodeData.nodeKind === "note" ? "note" : "table"
                    }}
                  </Badge>
                  <span
                    v-if="selectedNodeData.nodeKind === 'entity'"
                    class="text-xs text-muted-foreground/45"
                  >
                    {{
                      selectedNodeData.entityKind === "sqlite-table"
                        ? "sqlite"
                        : selectedNodeData.storageKind
                    }}
                  </span>
                </div>

                <p class="truncate pt-3 text-lg font-semibold text-foreground">
                  {{ selectedNodeData.title }}
                </p>
              </div>

              <div
                v-if="selectedNodeData.nodeKind === 'note'"
                class="mt-1 h-5 w-5 rounded-full border border-border/20"
                :style="{ backgroundColor: selectedNodeData.accent }"
              />
            </div>
          </div>

          <div
            v-if="selectedNodeData.nodeKind === 'entity'"
            class="grid grid-cols-3 gap-2 px-4 py-4"
          >
            <div
              class="rounded-2xl border border-border/15 bg-surface-1 px-3 py-3"
            >
              <div
                class="text-[10px] uppercase tracking-[0.16em] text-muted-foreground/35"
              >
                Fields
              </div>
              <div class="pt-2 text-lg font-semibold text-foreground">
                {{ selectedNodeData.fields.length }}
              </div>
            </div>
            <div
              class="rounded-2xl border border-border/15 bg-surface-1 px-3 py-3"
            >
              <div
                class="text-[10px] uppercase tracking-[0.16em] text-muted-foreground/35"
              >
                Rows
              </div>
              <div class="pt-2 text-sm font-semibold text-foreground">
                {{ selectedNodeData.statsLabel || "n/a" }}
              </div>
            </div>
            <div
              class="rounded-2xl border border-border/15 bg-surface-1 px-3 py-3"
            >
              <div
                class="text-[10px] uppercase tracking-[0.16em] text-muted-foreground/35"
              >
                Changes
              </div>
              <div class="pt-2 text-lg font-semibold text-foreground">
                {{ selectedNodeData.changeCount }}
              </div>
            </div>
          </div>
        </div>

        <template v-if="isNoteNode">
          <div class="space-y-2">
            <label
              class="text-[11px] uppercase tracking-[0.18em] text-muted-foreground/35"
              >Title</label
            >
            <Input
              v-model="noteTitle"
              class="h-10 rounded-xl text-sm"
              placeholder="Note title"
            />
          </div>

          <div class="space-y-2">
            <label
              class="text-[11px] uppercase tracking-[0.18em] text-muted-foreground/35"
              >Body</label
            >
            <Textarea
              v-model="noteBody"
              class="min-h-32 resize-none rounded-2xl text-sm"
              placeholder="Attach context to this canvas"
            />
          </div>

          <div class="space-y-2">
            <label
              class="text-[11px] uppercase tracking-[0.18em] text-muted-foreground/35"
              >Accent</label
            >
            <input
              v-model="noteAccent"
              type="color"
              class="h-11 w-full rounded-xl border border-border/25 bg-transparent px-2"
            />
          </div>

          <div class="flex items-center gap-2">
            <Button size="sm" class="h-9 text-xs" @click="saveNode"
              >Save note</Button
            >
            <Button
              variant="destructive"
              size="sm"
              class="h-9 text-xs"
              @click="
                props.selectedNode && emit('deleteNote', props.selectedNode.id)
              "
            >
              Delete
            </Button>
          </div>
        </template>

        <template v-else>
          <div class="space-y-2">
            <label
              class="text-[11px] uppercase tracking-[0.18em] text-muted-foreground/35"
              >Alias</label
            >
            <Input
              v-model="annotationLabel"
              class="h-10 rounded-xl text-sm"
              placeholder="Optional display alias"
            />
          </div>

          <div class="space-y-2">
            <label
              class="text-[11px] uppercase tracking-[0.18em] text-muted-foreground/35"
              >Attached note</label
            >
            <Textarea
              v-model="annotationNote"
              class="min-h-28 resize-none rounded-2xl text-sm"
              placeholder="Meaning, caveats, migration notes"
            />
          </div>

          <div class="flex items-center gap-2">
            <Button size="sm" class="h-9 text-xs" @click="saveNode"
              >Save</Button
            >
            <Button
              variant="outline"
              size="sm"
              class="h-9 gap-1 text-xs"
              @click="
                selectedNodeData.nodeKind === 'entity' &&
                emit('openNode', selectedNodeData.openPath)
              "
            >
              <TableProperties :size="13" />
              Open data
            </Button>
          </div>

          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <label
                class="text-[11px] uppercase tracking-[0.18em] text-muted-foreground/35"
                >Field map</label
              >
              <Badge variant="outline" class="gap-1 rounded-full">
                <TableProperties :size="12" />
                {{ selectedNodeData.fields.length }}
              </Badge>
            </div>

            <StorageGraphFieldSettings :fields="selectedNodeData.fields" />
          </div>
        </template>
      </div>

      <div v-else-if="selectedEdge" class="space-y-4">
        <div
          class="overflow-hidden rounded-[28px] border border-border/25 bg-surface-0 shadow-[0_18px_60px_-36px_rgba(0,0,0,0.68)]"
        >
          <div class="border-b border-border/15 px-4 py-4">
            <div class="flex items-center gap-2">
              <Badge variant="outline" class="gap-1 rounded-full">
                <Link2 :size="12" />
                {{ selectedEdge.kind }}
              </Badge>
              <span class="text-xs text-muted-foreground/45">relationship</span>
            </div>

            <p class="pt-3 text-sm font-semibold text-foreground">
              {{ selectedEdge.label || "Link" }}
            </p>
            <div
              class="mt-3 flex items-center gap-2 rounded-2xl border border-border/15 bg-surface-1 px-3 py-3 text-xs text-foreground/75"
            >
              <ArrowRightLeft :size="14" class="text-muted-foreground/45" />
              <span class="truncate font-mono">{{ selectedEdge.source }}</span>
              <span class="text-muted-foreground/35">→</span>
              <span class="truncate font-mono">{{ selectedEdge.target }}</span>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2 px-4 py-4">
            <div
              class="rounded-2xl border border-border/15 bg-surface-1 px-3 py-3"
            >
              <div
                class="text-[10px] uppercase tracking-[0.16em] text-muted-foreground/35"
              >
                Confidence
              </div>
              <div class="pt-2 text-sm font-semibold text-foreground">
                {{ selectedEdge.confidence }}
              </div>
            </div>
            <div
              class="rounded-2xl border border-border/15 bg-surface-1 px-3 py-3"
            >
              <div
                class="text-[10px] uppercase tracking-[0.16em] text-muted-foreground/35"
              >
                Type
              </div>
              <div class="pt-2 text-sm font-semibold text-foreground">
                {{ selectedEdge.kind }}
              </div>
            </div>
          </div>
        </div>

        <div class="space-y-2">
          <label
            class="text-[11px] uppercase tracking-[0.18em] text-muted-foreground/35"
            >Label</label
          >
          <Input
            v-model="edgeLabel"
            class="h-10 rounded-xl text-sm"
            placeholder="Link label"
          />
        </div>

        <div class="flex items-center gap-2">
          <Button
            size="sm"
            class="h-9 text-xs"
            :disabled="selectedEdge.kind !== 'manual'"
            @click="emit('saveEdge', { id: selectedEdge.id, label: edgeLabel })"
          >
            Save
          </Button>
          <Button
            variant="destructive"
            size="sm"
            class="h-9 text-xs"
            :disabled="selectedEdge.kind !== 'manual'"
            @click="emit('deleteEdge', selectedEdge.id)"
          >
            Delete
          </Button>
        </div>
      </div>

      <div v-else class="flex h-full min-h-72 items-center justify-center">
        <div
          class="max-w-[16rem] rounded-[28px] border border-dashed border-border/30 bg-surface-0/55 px-5 py-6 text-center"
        >
          <p class="text-sm font-medium text-foreground/75">Nothing selected</p>
          <p class="pt-2 text-xs leading-5 text-muted-foreground/45">
            Pick node or link. Right panel will show fields, relation details,
            and notes.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
