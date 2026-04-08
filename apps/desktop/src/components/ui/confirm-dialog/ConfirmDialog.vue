<script setup lang="ts">
import { computed } from "vue";
import { AlertTriangle } from "lucide-vue-next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const props = defineProps<{
  open: boolean;
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "destructive";
}>();

const emit = defineEmits<{
  confirm: [];
  cancel: [];
  "update:open": [value: boolean];
}>();

const isDestructive = computed(() => props.variant === "destructive");

function handleCancel() {
  emit("cancel");
  emit("update:open", false);
}

function handleConfirm() {
  emit("confirm");
  emit("update:open", false);
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="max-w-md">
      <DialogHeader>
        <div class="flex items-center gap-3">
          <div
            v-if="isDestructive"
            class="flex items-center justify-center w-10 h-10 rounded-full bg-error/10"
          >
            <AlertTriangle class="w-5 h-5 text-error" />
          </div>
          <DialogTitle>{{ title ?? "Confirm Action" }}</DialogTitle>
        </div>
        <DialogDescription v-if="description">
          {{ description }}
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" @click="handleCancel">
          {{ cancelText ?? "Cancel" }}
        </Button>
        <Button :variant="isDestructive ? 'destructive' : 'default'" @click="handleConfirm">
          {{ confirmText ?? "Confirm" }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
