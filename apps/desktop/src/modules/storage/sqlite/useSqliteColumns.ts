import { computed, h } from "vue";
import { createColumnHelper, type ColumnDef } from "@tanstack/vue-table";
import type { CheckboxCheckedState } from "reka-ui";
import { Checkbox } from "@/components/ui/checkbox";
import { Check } from "lucide-vue-next";
import type { RowRecord } from "./useSqliteAdvancedFilters";
import type { UseSqliteRowChangeStyles } from "./useSqliteRowChangeStyles";

interface UseSqliteColumnsOptions {
  columns: () => string[];
  changeIcon: UseSqliteRowChangeStyles["changeIcon"];
  changeIndicatorClass: UseSqliteRowChangeStyles["changeIndicatorClass"];
  rowChangeOperation: UseSqliteRowChangeStyles["rowChangeOperation"];
  isDeletedGhost: UseSqliteRowChangeStyles["isDeletedGhost"];
}

export function useSqliteColumns(options: UseSqliteColumnsOptions) {
  const columnHelper = createColumnHelper<RowRecord>();

  const columnsDef = computed<ColumnDef<RowRecord, unknown>[]>(() => {
    const selectCol = columnHelper.display({
      id: "__select",
      header: ({ table }) =>
        h(Checkbox, {
          modelValue: table.getIsAllRowsSelected()
            ? true
            : table.getIsSomeRowsSelected()
              ? "indeterminate"
              : false,
          "onUpdate:modelValue": (value: boolean | string) => {
            if (typeof value === "boolean") {
              table.toggleAllRowsSelected(value);
            } else {
              table.toggleAllRowsSelected();
            }
          },
          class: "h-3.5 w-3.5",
        }),
      size: 38,
      minSize: 34,
      maxSize: 42,
      enableHiding: false,
      enableResizing: false,
      enableGrouping: false,
      enableColumnFilter: true,
      cell: ({ row }) =>
        h("div", { class: "flex items-center justify-center gap-1" }, [
          (() => {
            const ChangeIcon = options.changeIcon(row.original);
            if (!ChangeIcon) return null;
            return h(
              "span",
              {
                class: [
                  "flex size-4 items-center justify-center rounded-sm ring-1",
                  options.changeIndicatorClass(row.original),
                ],
                title: options.rowChangeOperation(row.original) ?? undefined,
              },
              [h(ChangeIcon, { class: "size-2.5" })],
            );
          })(),
          h(
            Checkbox,
            {
              modelValue: row.getIsSelected(),
              disabled: options.isDeletedGhost(row.original),
              "onUpdate:modelValue": (value: CheckboxCheckedState) => {
                if (value !== row.getIsSelected()) {
                  row.toggleSelected();
                }
              },
              class: "h-3.5 w-3.5",
            },
            {
              default: ({ checked }: { checked: CheckboxCheckedState }) =>
                checked
                  ? h(Check, { class: "size-3" })
                  : !checked
                    ? null
                    : h("div", { class: "size-2.5 bg-primary rounded-sm" }),
            },
          ),
        ]),
    });

    const dataCols = options.columns().map((col) =>
      columnHelper.accessor((row) => row[col], {
        id: col,
        header: col,
        size: 200,
        minSize: 80,
        enableHiding: true,
        enableResizing: true,
        enableSorting: true,
        enableGrouping: true,
        enableColumnFilter: true,
        enableGlobalFilter: true,
        cell: (info) => {
          const v = info.getValue();
          if (v === null || v === undefined) return "";
          if (typeof v === "object") return JSON.stringify(v);
          if (typeof v === "string") return v;
          if (typeof v === "number" || typeof v === "boolean" || typeof v === "bigint") {
            return `${v}`;
          }
          return "";
        },
        filterFn: "includesString",
      }),
    );

    return [selectCol, ...dataCols];
  });

  return { columnsDef };
}
