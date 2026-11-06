import { computed, onBeforeUnmount, ref, shallowRef, watch, type Ref } from "vue";
import { useVirtualizer } from "@tanstack/vue-virtual";
import { useResizeObserver } from "@vueuse/core";
import {
  createCanvasMeasure,
  MIN_COLUMN_WIDTH,
  fillToWidth,
  measureColumnWidths,
  shrinkToWidth,
  type TextMeasure,
} from "./columnSizing";
import { readPersisted, writePersisted } from "@/lib/persisted";
import type { GridColumn, GridColumnType, GridRow, VisibleColumn } from "./types";

const INITIAL_RECT = { width: 1200, height: 720 };
/** Fractional device pixels (125 % scaling) must not tip a filled grid into a scrollbar. */
const SUBPIXEL_MARGIN = 2;
/** Mono only where the shape of the value matters; everything else is set in the sans face. */
const MONO_TYPES = new Set<GridColumnType>(["json", "blob", "date", "key"]);

export interface GridColumnsOptions {
  columns: Ref<readonly GridColumn[]>;
  /** Columns hidden by the host (`false` hides). */
  visibility: Ref<Readonly<Record<string, boolean>> | undefined>;
  /** Display-type overrides from "Show values as". */
  showAs: Ref<Readonly<Record<string, GridColumnType>> | undefined>;
  rows: Ref<readonly GridRow[]>;
  gutterWidth: Ref<number>;
  scroller: Ref<HTMLElement | null>;
  /** Storage key under which pins and hand-set widths are kept; `null` keeps them in memory. */
  layoutKey?: Ref<string | null>;
}

interface StoredLayout {
  pins: Record<string, "left" | "right">;
  widths: Record<string, number>;
}

const LAYOUT_PREFIX = "capubridge:grid-layout:";

function isStoredLayout(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const layout = value as Partial<StoredLayout>;
  return typeof layout.pins === "object" && typeof layout.widths === "object";
}

function fontFamily(variable: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(variable).trim() || fallback;
}

/**
 * Column layout for the grid: display order with pinned columns, content-aware and
 * user widths, and the horizontal virtualiser for the scrolling middle section.
 */
export function useGridColumns(options: GridColumnsOptions) {
  const pins = ref<Record<string, "left" | "right">>({});
  const userWidths = ref<Record<string, number>>({});
  const autoWidths = shallowRef<Record<string, number>>({});

  let loadingLayout = false;
  watch(
    () => options.layoutKey?.value ?? null,
    (key) => {
      loadingLayout = true;
      const stored = key
        ? readPersisted<StoredLayout>(
            `${LAYOUT_PREFIX}${key}`,
            { pins: {}, widths: {} },
            isStoredLayout,
          )
        : { pins: {}, widths: {} };
      pins.value = { ...stored.pins };
      userWidths.value = { ...stored.widths };
      loadingLayout = false;
    },
    { immediate: true },
  );
  watch([pins, userWidths], ([nextPins, nextWidths]) => {
    const key = options.layoutKey?.value;
    if (!key || loadingLayout || stopResize) return;
    writePersisted(`${LAYOUT_PREFIX}${key}`, { pins: nextPins, widths: nextWidths });
  });

  let sans: TextMeasure | null = null;
  let mono: TextMeasure | null = null;
  function measurer(column: GridColumn): TextMeasure {
    if (column.primaryKey || MONO_TYPES.has(column.type ?? "unknown")) {
      mono ??= createCanvasMeasure(`400 12px ${fontFamily("--font-mono", "monospace")}`);
      return mono;
    }
    sans ??= createCanvasMeasure(`400 12px ${fontFamily("--font-sans", "sans-serif")}`);
    return sans;
  }

  const viewportWidth = ref(0);

  /** Columns as displayed: visible, wide enough for the grid, with any "show as" type applied. */
  const effective = computed<GridColumn[]>(() => {
    const hidden = options.visibility.value ?? {};
    const overrides = options.showAs.value ?? {};
    const width = viewportWidth.value;
    return options.columns.value
      .filter((column) => hidden[column.id] !== false)
      .filter((column) => !column.hideBelow || width === 0 || width >= column.hideBelow)
      .map((column) => (overrides[column.id] ? { ...column, type: overrides[column.id] } : column));
  });

  const ordered = computed<GridColumn[]>(() => {
    const left = effective.value.filter((column) => pins.value[column.id] === "left");
    const right = effective.value.filter((column) => pins.value[column.id] === "right");
    const middle = effective.value.filter((column) => !pins.value[column.id]);
    return [...left, ...middle, ...right];
  });
  const leftCount = computed(() => ordered.value.filter((c) => pins.value[c.id] === "left").length);
  const rightCount = computed(
    () => ordered.value.filter((c) => pins.value[c.id] === "right").length,
  );
  const middleColumns = computed(() =>
    ordered.value.slice(leftCount.value, ordered.value.length - rightCount.value),
  );

  function measureAll(): Record<string, number> {
    const widths: Record<string, number> = {};
    for (const column of options.columns.value) {
      Object.assign(widths, measureColumnWidths([column], options.rows.value, measurer(column)));
    }
    return widths;
  }

  const columnsKey = computed(() =>
    options.columns.value.map((column) => column.id).join("\u0000"),
  );
  const hasRows = computed(() => options.rows.value.length > 0);
  let measuredWithRows: string | null = null;
  watch(
    [columnsKey, hasRows],
    ([key, rowsPresent]) => {
      if (!rowsPresent && measuredWithRows === key) return;
      autoWidths.value = measureAll();
      measuredWithRows = rowsPresent ? key : null;
    },
    { immediate: true },
  );

  watch(columnsKey, () => {
    if (options.columns.value.length === 0) return;
    const present = new Set(options.columns.value.map((column) => column.id));
    pins.value = Object.fromEntries(Object.entries(pins.value).filter(([id]) => present.has(id)));
  });

  useResizeObserver(options.scroller, (entries) => {
    const width = entries[0]?.contentRect.width ?? 0;
    if (Math.abs(width - viewportWidth.value) >= 1) viewportWidth.value = width;
  });

  /** Natural widths, grown to fill the viewport when the columns leave space. */
  const filledWidths = computed(() => {
    const order = ordered.value.map((column) => column.id);
    const base: Record<string, number> = {};
    for (const id of order) base[id] = userWidths.value[id] ?? autoWidths.value[id] ?? 120;
    const free = ordered.value.filter((column) => userWidths.value[column.id] === undefined);
    const growing = free.filter((column) => column.grow);
    const fillable = new Set((growing.length > 0 ? growing : free).map((column) => column.id));
    const shrinkable = new Map(
      growing.map((column) => [column.id, column.minWidth ?? MIN_COLUMN_WIDTH] as const),
    );
    const available = viewportWidth.value - options.gutterWidth.value - SUBPIXEL_MARGIN;
    if (available <= 0) return base;
    return shrinkToWidth(
      fillToWidth(base, order, fillable, available),
      order,
      shrinkable,
      available,
    );
  });

  function widthOf(id: string): number {
    return filledWidths.value[id] ?? userWidths.value[id] ?? autoWidths.value[id] ?? 120;
  }

  function sumWidths(columns: readonly GridColumn[]): number {
    return columns.reduce((total, column) => total + widthOf(column.id), 0);
  }

  const leftWidth = computed(() => sumWidths(ordered.value.slice(0, leftCount.value)));
  const rightWidth = computed(() =>
    sumWidths(ordered.value.slice(ordered.value.length - rightCount.value)),
  );

  const virtualizer = useVirtualizer(
    computed(() => ({
      horizontal: true,
      count: middleColumns.value.length,
      getScrollElement: () => options.scroller.value,
      estimateSize: (index: number) => widthOf(middleColumns.value[index]?.id ?? ""),
      paddingStart: options.gutterWidth.value + leftWidth.value,
      paddingEnd: rightWidth.value,
      scrollPaddingStart: options.gutterWidth.value + leftWidth.value,
      scrollPaddingEnd: rightWidth.value,
      overscan: 3,
      initialRect: INITIAL_RECT,
    })),
  );

  watch(
    [filledWidths, middleColumns, options.gutterWidth, leftWidth, rightWidth],
    () => virtualizer.value.measure(),
    { deep: true },
  );

  const pinnedLeft = computed<VisibleColumn[]>(() => {
    let offset = options.gutterWidth.value;
    return ordered.value.slice(0, leftCount.value).map((column, index) => {
      const entry: VisibleColumn = {
        column,
        index,
        width: widthOf(column.id),
        stick: { side: "left", offset },
      };
      offset += entry.width;
      return entry;
    });
  });

  const pinnedRight = computed<VisibleColumn[]>(() => {
    const start = ordered.value.length - rightCount.value;
    const columns = ordered.value.slice(start);
    let offset = 0;
    const entries: VisibleColumn[] = [];
    for (let i = columns.length - 1; i >= 0; i -= 1) {
      const column = columns[i];
      if (!column) continue;
      const width = widthOf(column.id);
      entries.unshift({ column, index: start + i, width, stick: { side: "right", offset } });
      offset += width;
    }
    return entries;
  });

  const scrolling = computed<VisibleColumn[]>(() =>
    virtualizer.value.getVirtualItems().flatMap((item) => {
      const column = middleColumns.value[item.index];
      return column ? [{ column, index: leftCount.value + item.index, width: item.size }] : [];
    }),
  );

  const leadingSpace = computed(() => {
    const first = virtualizer.value.getVirtualItems()[0];
    return first ? first.start - options.gutterWidth.value - leftWidth.value : 0;
  });
  const totalWidth = computed(() => virtualizer.value.getTotalSize());
  /** The columns fit the viewport, so no horizontal scrollbar should show. */
  const fits = computed(
    () => viewportWidth.value > 0 && totalWidth.value <= viewportWidth.value + 1,
  );

  /** Brings a column (display index) into view; pinned columns are always visible. */
  function reveal(index: number) {
    const middleIndex = index - leftCount.value;
    if (middleIndex < 0 || middleIndex >= middleColumns.value.length) return;
    virtualizer.value.scrollToIndex(middleIndex, { align: "auto" });
  }

  function pin(columnId: string, side: "left" | "right" | null) {
    const next = { ...pins.value };
    if (side) next[columnId] = side;
    else delete next[columnId];
    pins.value = next;
  }

  function autosize(columnId: string) {
    const column = options.columns.value.find((entry) => entry.id === columnId);
    if (!column) return;
    const measured = measureColumnWidths(
      [{ ...column, width: undefined }],
      options.rows.value,
      measurer(column),
    );
    userWidths.value = { ...userWidths.value, [columnId]: measured[columnId] ?? widthOf(columnId) };
  }

  function autosizeAll() {
    userWidths.value = {};
    autoWidths.value = measureAll();
  }

  let stopResize: (() => void) | null = null;
  function startResize(columnId: string, event: PointerEvent) {
    const startX = event.clientX;
    const startWidth = widthOf(columnId);
    const onMove = (moveEvent: PointerEvent) => {
      const next = Math.min(1200, Math.max(48, startWidth + moveEvent.clientX - startX));
      userWidths.value = { ...userWidths.value, [columnId]: next };
    };
    const onUp = () => stopResize?.();
    stopResize = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.style.cursor = "";
      stopResize = null;
      const key = options.layoutKey?.value;
      if (key) {
        writePersisted(`${LAYOUT_PREFIX}${key}`, { pins: pins.value, widths: userWidths.value });
      }
    };
    document.body.style.cursor = "col-resize";
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }
  onBeforeUnmount(() => stopResize?.());

  return {
    ordered,
    pins,
    pinnedLeft,
    pinnedRight,
    scrolling,
    leadingSpace,
    totalWidth,
    fits,
    reveal,
    pin,
    autosize,
    autosizeAll,
    startResize,
  };
}
