<script setup lang="ts">
import { computed } from "vue";

type DiffSide = "same" | "add" | "remove" | "change" | "empty";

interface DiffRow {
  id: string;
  leftLine: number | null;
  rightLine: number | null;
  leftText: string;
  rightText: string;
  leftKind: DiffSide;
  rightKind: DiffSide;
}

const props = defineProps<{
  beforeValue?: unknown;
  afterValue?: unknown;
}>();

function stringify(value: unknown) {
  if (value === undefined) return "";
  return JSON.stringify(value, null, 2);
}

function buildSimpleDiff(beforeLines: string[], afterLines: string[]): DiffRow[] {
  const maxLength = Math.max(beforeLines.length, afterLines.length);
  const rows: DiffRow[] = [];

  for (let index = 0; index < maxLength; index += 1) {
    const leftText = beforeLines[index] ?? "";
    const rightText = afterLines[index] ?? "";
    const same = leftText === rightText;
    const leftMissing = index >= beforeLines.length;
    const rightMissing = index >= afterLines.length;

    rows.push({
      id: `simple-${index}`,
      leftLine: leftMissing ? null : index + 1,
      rightLine: rightMissing ? null : index + 1,
      leftText,
      rightText,
      leftKind: same ? "same" : leftMissing ? "empty" : rightMissing ? "remove" : "change",
      rightKind: same ? "same" : rightMissing ? "empty" : leftMissing ? "add" : "change",
    });
  }

  return rows;
}

function buildLcsDiff(beforeLines: string[], afterLines: string[]): DiffRow[] {
  const leftLength = beforeLines.length;
  const rightLength = afterLines.length;
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
        beforeLines[left] === afterLines[right]
          ? getCell(left + 1, right + 1) + 1
          : Math.max(getCell(left + 1, right), getCell(left, right + 1)),
      );
    }
  }

  const rows: DiffRow[] = [];
  let left = 0;
  let right = 0;
  let rowId = 0;

  while (left < leftLength || right < rightLength) {
    if (left < leftLength && right < rightLength && beforeLines[left] === afterLines[right]) {
      rows.push({
        id: `same-${rowId++}`,
        leftLine: left + 1,
        rightLine: right + 1,
        leftText: beforeLines[left] ?? "",
        rightText: afterLines[right] ?? "",
        leftKind: "same",
        rightKind: "same",
      });
      left += 1;
      right += 1;
      continue;
    }

    const removed: string[] = [];
    const added: string[] = [];
    const removedStart = left;
    const addedStart = right;

    while (
      left < leftLength &&
      (right >= rightLength || getCell(left + 1, right) >= getCell(left, right + 1))
    ) {
      removed.push(beforeLines[left] ?? "");
      left += 1;
    }

    while (
      right < rightLength &&
      (left >= leftLength || getCell(left, right + 1) > getCell(left + 1, right))
    ) {
      added.push(afterLines[right] ?? "");
      right += 1;
    }

    const pairCount = Math.max(removed.length, added.length);

    for (let index = 0; index < pairCount; index += 1) {
      const hasRemoved = index < removed.length;
      const hasAdded = index < added.length;

      rows.push({
        id: `diff-${rowId++}`,
        leftLine: hasRemoved ? removedStart + index + 1 : null,
        rightLine: hasAdded ? addedStart + index + 1 : null,
        leftText: removed[index] ?? "",
        rightText: added[index] ?? "",
        leftKind: hasRemoved ? (hasAdded ? "change" : "remove") : "empty",
        rightKind: hasAdded ? (hasRemoved ? "change" : "add") : "empty",
      });
    }
  }

  return rows;
}

const rows = computed(() => {
  const beforeLines = stringify(props.beforeValue).split("\n");
  const afterLines = stringify(props.afterValue).split("\n");
  const cellCount = beforeLines.length * afterLines.length;

  if (cellCount > 48400) {
    return buildSimpleDiff(beforeLines, afterLines);
  }

  return buildLcsDiff(beforeLines, afterLines);
});

function getCellClass(kind: DiffSide) {
  if (kind === "add") return "bg-emerald-500/10 text-emerald-100";
  if (kind === "remove") return "bg-red-500/10 text-red-100";
  if (kind === "change") return "bg-amber-500/10 text-amber-50";
  if (kind === "empty") return "bg-surface-2/60 text-transparent";
  return "text-foreground/80";
}
</script>

<template>
  <div class="grid h-full grid-cols-2 overflow-hidden rounded-md border border-border/30 bg-surface-1">
    <div class="flex min-w-0 flex-col border-r border-border/30">
      <div class="h-8 shrink-0 border-b border-border/30 px-3 py-1.5 text-xs text-muted-foreground">
        Before
      </div>
      <div class="min-h-0 flex-1 overflow-auto font-mono text-xs leading-5">
        <div
          v-for="row in rows"
          :key="`${row.id}-left`"
          class="grid grid-cols-[48px_1fr] border-l-2"
          :class="[
            getCellClass(row.leftKind),
            row.leftKind === 'remove' ? 'border-l-red-500/70' : '',
            row.leftKind === 'change' ? 'border-l-amber-500/70' : '',
            row.leftKind !== 'remove' && row.leftKind !== 'change' ? 'border-l-transparent' : '',
          ]"
        >
          <span class="select-none px-2 text-right text-muted-foreground/35">
            {{ row.leftLine ?? "" }}
          </span>
          <pre class="min-w-0 overflow-visible whitespace-pre px-2">{{ row.leftText }}</pre>
        </div>
      </div>
    </div>

    <div class="flex min-w-0 flex-col">
      <div class="h-8 shrink-0 border-b border-border/30 px-3 py-1.5 text-xs text-muted-foreground">
        After
      </div>
      <div class="min-h-0 flex-1 overflow-auto font-mono text-xs leading-5">
        <div
          v-for="row in rows"
          :key="`${row.id}-right`"
          class="grid grid-cols-[48px_1fr] border-l-2"
          :class="[
            getCellClass(row.rightKind),
            row.rightKind === 'add' ? 'border-l-emerald-500/70' : '',
            row.rightKind === 'change' ? 'border-l-amber-500/70' : '',
            row.rightKind !== 'add' && row.rightKind !== 'change' ? 'border-l-transparent' : '',
          ]"
        >
          <span class="select-none px-2 text-right text-muted-foreground/35">
            {{ row.rightLine ?? "" }}
          </span>
          <pre class="min-w-0 overflow-visible whitespace-pre px-2">{{ row.rightText }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>
