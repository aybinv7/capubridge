<script setup lang="ts">
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { TargetRef } from "@/types/automation.types";

const props = defineProps<{
  target: TargetRef | undefined;
  allowNone: boolean;
}>();

const emit = defineEmits<{
  change: [target: TargetRef | undefined];
}>();

function kindOf(): string {
  return props.target?.kind ?? "none";
}

function selectKind(kind: string): void {
  if (kind === "none") {
    emit("change", undefined);
    return;
  }
  emit("change", defaultTargetFor(kind as TargetRef["kind"]));
}

function defaultTargetFor(kind: TargetRef["kind"]): TargetRef {
  switch (kind) {
    case "selector":
      return { kind: "selector", cssSelector: "#selector" };
    case "text":
      return { kind: "text", text: "", exact: false };
    case "nativeIndex":
      return { kind: "nativeIndex", index: 0 };
    case "point":
      return { kind: "point", x: 0, y: 0 };
  }
}

function setSelector(value: string): void {
  emit("change", { kind: "selector", cssSelector: value });
}

function setText(value: string, exact: boolean): void {
  emit("change", { kind: "text", text: value, exact });
}

function setNativeIndex(value: string): void {
  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed >= 0) {
    emit("change", { kind: "nativeIndex", index: parsed });
  }
}

function setPoint(axis: "x" | "y", value: string): void {
  const current = props.target;
  if (current?.kind !== "point") {
    return;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return;
  }
  emit("change", { ...current, [axis]: parsed });
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <Select :model-value="kindOf()" @update:model-value="(value) => selectKind(String(value))">
      <SelectTrigger class="h-8">
        <SelectValue placeholder="Target kind" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="selector">Selector (strongest)</SelectItem>
        <SelectItem value="text">Text</SelectItem>
        <SelectItem value="nativeIndex">Native index</SelectItem>
        <SelectItem value="point">Raw point (weakest)</SelectItem>
        <SelectItem v-if="allowNone" value="none">None</SelectItem>
      </SelectContent>
    </Select>
    <Input
      v-if="target?.kind === 'selector'"
      :model-value="target.cssSelector"
      placeholder="CSS selector, e.g. #login"
      @update:model-value="(value) => setSelector(String(value))"
    />
    <div v-if="target?.kind === 'text'" class="flex flex-col gap-2">
      <Input
        :model-value="target.text"
        placeholder="Text to match"
        @update:model-value="(value) => setText(String(value), target.exact)"
      />
      <label class="flex items-center gap-2 text-sm text-muted-foreground">
        <Switch
          :model-value="target.exact"
          @update:model-value="(value) => setText(target.text, value === true)"
        />
        Exact match
      </label>
    </div>
    <div v-if="target?.kind === 'nativeIndex'" class="flex flex-col gap-1">
      <Label>Native index</Label>
      <Input
        :model-value="String(target.index)"
        inputmode="numeric"
        @update:model-value="(value) => setNativeIndex(String(value))"
      />
    </div>
    <div v-if="target?.kind === 'point'" class="flex gap-2">
      <Input
        :model-value="String(target.x)"
        inputmode="numeric"
        aria-label="Point x"
        @update:model-value="(value) => setPoint('x', String(value))"
      />
      <Input
        :model-value="String(target.y)"
        inputmode="numeric"
        aria-label="Point y"
        @update:model-value="(value) => setPoint('y', String(value))"
      />
    </div>
  </div>
</template>
