export const listClasses = 'cladd-list flex flex-col p-2';

export const listItemClasses =
  'cladd-list-item flex min-h-9 items-center gap-4 px-2 py-1 text-cladd-xs font-medium';

export const listTitleClasses =
  'cladd-list-title flex items-end gap-4 p-2 text-cladd-xs font-medium text-cladd-fg-soft uppercase select-none';

export const listSeparatorClasses =
  'cladd-list-separator -mx-2 my-2 h-px bg-cladd-outline';

export const sectionTitleClasses =
  'cladd-section-title flex items-end gap-4 text-cladd-xs font-medium text-cladd-fg-soft uppercase select-none';

export const listButtonClasses = 'cladd-list-button z-10 w-full';

export const listButtonContentClasses = 'gap-4 px-2';

export const listButtonIconClasses = 'relative shrink-0 [&>svg]:shrink-0';

export const listButtonInnerContentClasses =
  'relative flex w-full min-w-0 shrink flex-col gap-1';

export const listButtonHeaderClasses =
  'text-cladd-xs leading-tight font-normal text-cladd-fg-soft';

export const listButtonTitleClasses =
  'flex items-center gap-4 [&>svg]:shrink-0';

export const listButtonFooterClasses =
  'text-cladd-xs leading-tight font-normal text-cladd-fg-softer';

export const listButtonAfterClasses = 'ml-auto shrink-0 [&>svg]:shrink-0';

/** Takes no own props; upstream's are the native element props plus `children` and `ref`. */
export type ListProps = Record<string, never>;

/** Takes no own props; upstream's are the native element props plus `children` and `ref`. */
export type ListItemProps = Record<string, never>;

/** Takes no own props; upstream's are the native element props plus `children` and `ref`. */
export type ListSeparatorProps = Record<string, never>;

/** Takes no own props; upstream's are the native element props plus `children` and `ref`. */
export type ListTitleProps = Record<string, never>;
