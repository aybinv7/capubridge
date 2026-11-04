# Select

`Select` is the native Vue port of Cladd's button-and-popover selection control. It supports single and multiple selection, search, desktop numeric hints, object options, rich option rows, section slots, and controlled popover state.

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { Select } from 'cladd-vue';

const priority = ref('medium');
const priorities = [
  { label: 'Low', value: 'low' },
  { label: 'Medium', value: 'medium' },
  { label: 'High', value: 'high' },
];
</script>

<template>
  <Select
    v-model="priority"
    color="brand"
    :options="priorities"
    title="Priority"
  />
</template>
```

## Selection

`v-model` accepts a scalar `SelectValue` in single mode and `SelectValue[]` with `multiple`. `closeOnSelect` defaults to `true` for single selection; multi-select remains open so several values can be toggled.

Object options can provide `label`, `value`, `info`, and `disabled`. For other object shapes, use `getOptionValue`, `optionLabel`, `optionInfo`, `isOptionDisabled`, and `optionIndicatorColor`.

## Slots

| Slot                            | Purpose                                                       |
| ------------------------------- | ------------------------------------------------------------- |
| `default`                       | Custom trigger value with current value and selected options. |
| `icon`, `dropdownIcon`          | Trigger adornments.                                           |
| `beforeOptions`, `afterOptions` | Content around the complete option list.                      |
| `beforeOption`, `afterOption`   | Per-option section content.                                   |
| `option`, `optionInfo`          | Rich option label and supporting content.                     |
| `empty`                         | Custom search empty state.                                    |

## Interaction

The trigger exposes combobox semantics and the popover uses a listbox. Arrow keys and Tab move the active option, Enter or Space selects, Escape dismisses, and numeric hints map `1` through `9` plus `0` on non-touch devices. `noneOptionValue` reserves `0` for a semantic empty option.

Search supports built-in label matching or a caller-provided `searchFilter`. `searchFocus` focuses the field after the opening transition and `scrollToSelected` centers the selected row.

## Upstream evidence

The contract follows the pinned Cladd `Select.tsx`, `List.tsx`, `ListButton.tsx`, and `DropdownIcon.tsx` sources plus the public [Select documentation](https://cladd.io/react/components/select/). React render callbacks become typed Vue slots where slot composition is the idiomatic equivalent.
