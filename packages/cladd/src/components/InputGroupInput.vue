<script setup lang="ts">
import { computed, useAttrs } from 'vue';

import { useComponentDefaults } from '../composables/useComponentDefaults.ts';
import { cn } from '../shared/cn.ts';
import { useFieldContext } from './fieldContext.ts';
import Input from './Input.vue';
import type { InputGroupInputProps } from './inputGroup.contracts.ts';
import { useInputGroupContext } from './inputGroupContext.ts';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<InputGroupInputProps>(), {
  disabled: undefined,
  inputId: undefined,
  name: undefined,
  placeholder: undefined,
  readOnly: undefined,
  required: undefined,
  type: undefined,
  valid: undefined,
});

const emit = defineEmits<{
  change: [value: string, event: Event];
}>();

const model = defineModel<string>({ default: '' });

const attrs = useAttrs();
const d = useComponentDefaults('InputGroupInput', props, {
  type: 'text',
  valid: true,
});

const field = useFieldContext();
const group = useInputGroupContext();

const inputId = computed(
  () => props.inputId ?? field?.controlId.value ?? group?.controlId.value,
);
const describedBy = computed(() => field?.describedBy.value);
const invalid = computed(
  () => !(d.value.valid ?? true) || (field?.invalid.value ?? false),
);
const disabled = computed(
  () =>
    d.value.disabled || group?.disabled.value || field?.disabled.value || false,
);
const required = computed(
  () => d.value.required || field?.required.value || false,
);

const rootAttrs = computed(() => {
  const { class: _consumerClass, ...rest } = attrs;
  return rest;
});
const rootClass = computed(() => cn('min-w-0 flex-1', attrs.class));
</script>

<template>
  <Input
    v-bind="rootAttrs"
    v-model="model"
    :aria-describedby="describedBy"
    :aria-invalid="invalid || undefined"
    :class="rootClass"
    data-slot="input-group-control"
    :disabled="disabled"
    :input-id="inputId"
    :name="d.name"
    :placeholder="d.placeholder"
    :read-only="d.readOnly"
    :required="required"
    :type="d.type"
    :valid="!invalid"
    @change="(value, event) => emit('change', value, event)"
  />
</template>
