/** Dense row height flag shared by the table family. */
export type TableDensity = 'comfortable' | 'compact';

export interface TableProps {
  /** Compact row height. Default `false`. */
  dense?: boolean;
  /** Highlight rows on hover. Default `false`. */
  hoverable?: boolean;
  /** Keep the header visible inside the table container. Default `false`. */
  stickyHeader?: boolean;
  /** Extra classes for the horizontal-overflow wrapper. */
  wrapperClassName?: string;
}

export type TableDefaultProps = Partial<TableProps>;

export interface TableHeaderProps {
  /** Keep this header stuck to the container top. Default `false`. */
  sticky?: boolean;
}

export type TableHeaderDefaultProps = Partial<TableHeaderProps>;

export interface TableBodyProps {
  /** Show the empty-state row when there are no body rows. Default `false`. */
  empty?: boolean;
}

export type TableBodyDefaultProps = Partial<TableBodyProps>;

export interface TableFooterProps {
  /** Pin the footer to the container bottom. Default `false`. */
  sticky?: boolean;
}

export type TableFooterDefaultProps = Partial<TableFooterProps>;

export interface TableRowProps {
  /** Selected-row styling. Default `false`. */
  selected?: boolean;
  /** Override the table hoverable flag for this row. */
  hoverable?: boolean;
}

export type TableRowDefaultProps = Partial<TableRowProps>;

export interface TableHeadProps {
  /** Native header scope. Default `'col'`. */
  scope?: 'col' | 'row' | 'colgroup' | 'rowgroup';
  /** Right-align tabular numbers. Default `false`. */
  numeric?: boolean;
  /** Column sort direction for the header sort button. */
  sortDirection?: 'asc' | 'desc' | 'none';
}

export type TableHeadDefaultProps = Partial<TableHeadProps>;

export interface TableCellProps {
  /** Right-align tabular numbers. Default `false`. */
  numeric?: boolean;
}

export type TableCellDefaultProps = Partial<TableCellProps>;

export interface TableCaptionProps {
  /** Visually hide the caption while keeping it announced. Default `false`. */
  visuallyHidden?: boolean;
}

export type TableCaptionDefaultProps = Partial<TableCaptionProps>;

/** Sort direction for the consumer-owned data-table recipe. */
export type TableSortDirection = 'asc' | 'desc' | 'none';

/** Controlled sort state for the consumer-owned data-table recipe. */
export interface TableSortState {
  /** Sorted column key. */
  key: string;
  /** Sort direction. */
  direction: TableSortDirection;
}

/** Column descriptor for the consumer-owned data-table recipe. */
export interface TableColumn {
  /** Stable column key. */
  key: string;
  /** Visible header label. */
  label: string;
  /** Right-align tabular numbers. Default `false`. */
  numeric?: boolean;
  /** Allow sorting through the header button. Default `false`. */
  sortable?: boolean;
}
