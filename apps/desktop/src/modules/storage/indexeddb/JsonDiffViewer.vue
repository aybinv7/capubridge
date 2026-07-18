<script setup lang="ts">
import { computed, ref } from "vue";
import JsonEditor from "@/shared/components/data/JsonEditor.vue";

type DiffKind = "same" | "add" | "remove" | "change" | "empty";

interface DiffRow {
  leftLine: number | null;
  rightLine: number | null;
  leftKind: DiffKind;
  rightKind: DiffKind;
}

const props = defineProps<{
  beforeValue?: unknown;
  afterText: string;
  readonly?: boolean;
}>();

const emit = defineEmits<{
  "update:afterText": [value: string];
  "validity-change": [valid: boolean];
}>();

const beforeEditorRef = ref<InstanceType<typeof JsonEditor> | null>(null);
const afterEditorRef = ref<InstanceType<typeof JsonEditor> | null>(null);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function encodePrimitive(value: unknown) {
  const encoded = JSON.stringify(value);
  return encoded === undefined ? "null" : encoded;
}

function orderedKeys(value: Record<string, unknown>, preferred: unknown) {
  const keys = new Set<string>();
  if (isRecord(preferred)) {
    for (const key of Object.keys(preferred)) keys.add(key);
  }
  for (const key of Object.keys(value)) keys.add(key);
  return Array.from(keys).filter((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function stringifyWithPreferredOrder(value: unknown, preferred: unknown, level = 0): string {
  const indent = "  ".repeat(level);
  const nextIndent = "  ".repeat(level + 1);

  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    const preferredItems = Array.isArray(preferred) ? preferred : [];
    const lines = value.map(
      (item, index) =>
        `${nextIndent}${stringifyWithPreferredOrder(item, preferredItems[index], level + 1)}`,
    );
    return `[\n${lines.join(",\n")}\n${indent}]`;
  }

  if (isRecord(value)) {
    const keys = orderedKeys(value, preferred);
    if (keys.length === 0) return "{}";
    const preferredRecord = isRecord(preferred) ? preferred : {};
    const lines = keys.map(
      (key) =>
        `${nextIndent}${JSON.stringify(key)}: ${stringifyWithPreferredOrder(
          value[key],
          preferredRecord[key],
          level + 1,
        )}`,
    );
    return `{\n${lines.join(",\n")}\n${indent}}`;
  }

  return encodePrimitive(value);
}

function parseJson(text: string) {
  try {
    return { ok: true as const, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false as const };
  }
}

const beforeText = computed(() => {
  if (props.beforeValue === undefined) return "";
  const parsedAfter = parseJson(props.afterText);
  if (!parsedAfter.ok) return JSON.stringify(props.beforeValue, null, 2) ?? "";
  return stringifyWithPreferredOrder(props.beforeValue, parsedAfter.value);
});

// When beforeValue is undefined (new record), treat it as zero lines so all
// after-lines are classified as "add" rather than "change" vs an empty string.
const beforeLines = computed(() =>
  props.beforeValue === undefined ? [] : beforeText.value.split("\n"),
);

function buildSimpleDiff(bl: string[], al: string[]): DiffRow[] {
  const rows: DiffRow[] = [];
  const maxLength = Math.max(bl.length, al.length);

  for (let index = 0; index < maxLength; index += 1) {
    const same = bl[index] === al[index];
    const leftMissing = index >= bl.length;
    const rightMissing = index >= al.length;

    rows.push({
      leftLine: leftMissing ? null : index,
      rightLine: rightMissing ? null : index,
      leftKind: same ? "same" : leftMissing ? "empty" : rightMissing ? "remove" : "change",
      rightKind: same ? "same" : rightMissing ? "empty" : leftMissing ? "add" : "change",
    });
  }

  return rows;
}

function buildLcsDiff(bl: string[], al: string[]): DiffRow[] {
  const leftLength = bl.length;
  const rightLength = al.length;
  const cells = Array.from({ length: leftLength + 1 }, () =>
    Array<number>(rightLength + 1).fill(0),
  );

  function getCell(left: number, right: number) {
    return cells[left]?.[right] ?? 0;
  }

  function setCell(left: number, right: number, value: number) {
    const row = cells[left];
    if (row) row[right] = value;
  }

  for (let left = leftLength - 1; left >= 0; left -= 1) {
    for (let right = rightLength - 1; right >= 0; right -= 1) {
      setCell(
        left,
        right,
        bl[left] === al[right]
          ? getCell(left + 1, right + 1) + 1
          : Math.max(getCell(left + 1, right), getCell(left, right + 1)),
      );
    }
  }

  const rows: DiffRow[] = [];
  let left = 0;
  let right = 0;

  while (left < leftLength || right < rightLength) {
    if (left < leftLength && right < rightLength && bl[left] === al[right]) {
      rows.push({
        leftLine: left,
        rightLine: right,
        leftKind: "same",
        rightKind: "same",
      });
      left += 1;
      right += 1;
      continue;
    }

    const removedStart = left;
    const addedStart = right;
    const removed: number[] = [];
    const added: number[] = [];

    while (
      left < leftLength &&
      (right >= rightLength || getCell(left + 1, right) >= getCell(left, right + 1))
    ) {
      removed.push(left);
      left += 1;
    }

    while (
      right < rightLength &&
      (left >= leftLength || getCell(left, right + 1) > getCell(left + 1, right))
    ) {
      added.push(right);
      right += 1;
    }

    const pairCount = Math.max(removed.length, added.length);

    for (let index = 0; index < pairCount; index += 1) {
      const hasRemoved = index < removed.length;
      const hasAdded = index < added.length;

      rows.push({
        leftLine: hasRemoved ? removedStart + index : null,
        rightLine: hasAdded ? addedStart + index : null,
        leftKind: hasRemoved ? (hasAdded ? "change" : "remove") : "empty",
        rightKind: hasAdded ? (hasRemoved ? "change" : "add") : "empty",
      });
    }
  }

  return rows;
}

function diffClass(kind: DiffKind) {
  if (kind === "add") return "border-l-2 border-emerald-500/70 bg-emerald-500/10";
  if (kind === "remove") return "border-l-2 border-red-500/70 bg-red-500/10";
  if (kind === "change") return "border-l-2 border-amber-500/70 bg-amber-500/10";
  return "";
}

const diffRows = computed(() => {
  const bl = beforeLines.value;
  const al = props.afterText.split("\n");
  const cellCount = bl.length * al.length;
  return cellCount > 48400 ? buildSimpleDiff(bl, al) : buildLcsDiff(bl, al);
});

// Find character-level diff ranges between two changed lines using the
// common-prefix / common-suffix approach (fast, readable for JSON diffs).
function findCharDiffRanges(
  before: string,
  after: string,
): { beforeRanges: [number, number][]; afterRanges: [number, number][] } {
  const minLen = Math.min(before.length, after.length);
  let start = 0;
  while (start < minLen && before[start] === after[start]) start++;

  let beforeEnd = before.length;
  let afterEnd = after.length;
  while (beforeEnd > start && afterEnd > start && before[beforeEnd - 1] === after[afterEnd - 1]) {
    beforeEnd--;
    afterEnd--;
  }

  return {
    beforeRanges: beforeEnd > start ? [[start, beforeEnd]] : [],
    afterRanges: afterEnd > start ? [[start, afterEnd]] : [],
  };
}

const diffLineClasses = computed(() => {
  const before = new Map<number, string>();
  const after = new Map<number, string>();

  for (const row of diffRows.value) {
    if (row.leftLine !== null) before.set(row.leftLine, diffClass(row.leftKind));
    if (row.rightLine !== null) after.set(row.rightLine, diffClass(row.rightKind));
  }

  return {
    before: (lineIndex: number) => before.get(lineIndex) ?? "",
    after: (lineIndex: number) => after.get(lineIndex) ?? "",
  };
});

// Char-level ranges for lines where both sides changed (kind === "change").
// Only "change" rows get inline char highlighting; pure add/remove rows are
// already fully coloured by their line background.
const lineCharHighlight = computed(() => {
  const bl = beforeLines.value;
  const al = props.afterText.split("\n");
  const before = new Map<number, { ranges: [number, number][]; kind: "add" | "remove" }>();
  const after = new Map<number, { ranges: [number, number][]; kind: "add" | "remove" }>();

  for (const row of diffRows.value) {
    if (
      row.leftKind === "change" &&
      row.rightKind === "change" &&
      row.leftLine !== null &&
      row.rightLine !== null
    ) {
      const { beforeRanges, afterRanges } = findCharDiffRanges(
        bl[row.leftLine] ?? "",
        al[row.rightLine] ?? "",
      );
      if (beforeRanges.length > 0)
        before.set(row.leftLine, { ranges: beforeRanges, kind: "remove" });
      if (afterRanges.length > 0) after.set(row.rightLine, { ranges: afterRanges, kind: "add" });
    }
  }

  return {
    before: (i: number) => before.get(i) ?? null,
    after: (i: number) => after.get(i) ?? null,
  };
});

// ─── Scroll sync ───────────────────────────────────────────────────────────────
// The _lastScrollTop change-detection inside JsonEditor's syncScroll naturally
// terminates circular calls: A→B→A fires syncScroll on A but emits nothing
// because the position is already at the target value.

function onBeforeScroll(top: number) {
  afterEditorRef.value?.setScrollTop(top);
}

function onAfterScroll(top: number) {
  beforeEditorRef.value?.setScrollTop(top);
}

function focusSearch() {
  afterEditorRef.value?.filterInputRef?.focus();
  afterEditorRef.value?.filterInputRef?.select();
}

function focusEditor() {
  afterEditorRef.value?.textareaRef?.focus();
}

function collapseAll() {
  beforeEditorRef.value?.collapseAll();
  afterEditorRef.value?.collapseAll();
}

function expandAll() {
  beforeEditorRef.value?.expandAll();
  afterEditorRef.value?.expandAll();
}

defineExpose({
  focusSearch,
  focusEditor,
  collapseAll,
  expandAll,
});
</script>

<template>
  <div
    class="grid h-full min-h-0 grid-cols-2 overflow-hidden rounded-md border border-border/30 bg-surface-1"
  >
    <!-- Before panel -->
    <div class="flex min-h-0 min-w-0 flex-col border-r border-border/30">
      <JsonEditor
        ref="beforeEditorRef"
        :value="beforeText"
        readonly
        :line-class="diffLineClasses.before"
        :line-char-highlight="lineCharHighlight.before"
        @scroll="onBeforeScroll"
      />
    </div>

    <!-- After panel -->
    <div class="flex min-h-0 min-w-0 flex-col">
      <JsonEditor
        ref="afterEditorRef"
        :value="afterText"
        :readonly="readonly"
        :line-class="diffLineClasses.after"
        :line-char-highlight="lineCharHighlight.after"
        @update:value="emit('update:afterText', $event)"
        @validity-change="emit('validity-change', $event)"
        @scroll="onAfterScroll"
      />
    </div>
  </div>
</template>
