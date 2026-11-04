import { expect, test } from 'vite-plus/test';
import { h, nextTick } from 'vue';

import Checkbox from '../../src/components/Checkbox.vue';
import Field from '../../src/components/Field.vue';
import FieldDescription from '../../src/components/FieldDescription.vue';
import FieldError from '../../src/components/FieldError.vue';
import FieldGroup from '../../src/components/FieldGroup.vue';
import FieldLabel from '../../src/components/FieldLabel.vue';
import FieldLegend from '../../src/components/FieldLegend.vue';
import FieldSet from '../../src/components/FieldSet.vue';
import Input from '../../src/components/Input.vue';
import InputGroup from '../../src/components/InputGroup.vue';
import InputGroupAddon from '../../src/components/InputGroupAddon.vue';
import InputGroupButton from '../../src/components/InputGroupButton.vue';
import InputGroupInput from '../../src/components/InputGroupInput.vue';
import { mountTree } from '../support/mountTree.ts';

function mount(node: ReturnType<typeof h>) {
  const tree = mountTree(node);
  return tree;
}

test('label activates the control through the generated id', () => {
  const { app, root } = mount(
    h(Field, null, {
      default: () => [
        h(FieldLabel, null, { default: () => 'Name' }),
        h(Input, { modelValue: '', 'onUpdate:modelValue': () => {} }),
      ],
    }),
  );

  const label = root.querySelector('label');
  const input = root.querySelector('input');
  expect(label?.getAttribute('for')).toBe(input?.id);
  expect(input?.id).toMatch(/-control$/);
  app.unmount();
  root.remove();
});

test('explicit consumer ids win over generated ids', () => {
  const { app, root } = mount(
    h(
      Field,
      { controlId: 'custom-control' },
      {
        default: () => [
          h(FieldLabel, null, { default: () => 'Name' }),
          h(
            FieldDescription,
            { descriptionId: 'custom-hint' },
            {
              default: () => 'Hint',
            },
          ),
          h(Input, { modelValue: '', 'onUpdate:modelValue': () => {} }),
        ],
      },
    ),
  );

  const input = root.querySelector('input');
  expect(input?.id).toBe('custom-control');
  expect(root.querySelector('[data-slot="field-description"]')?.id).toBe(
    'custom-hint',
  );
  expect(input?.getAttribute('aria-describedby')).toContain('custom-hint');
  app.unmount();
  root.remove();
});

test('invalid controls expose aria-invalid with joined description ids', () => {
  const { app, root } = mount(
    h(
      Field,
      { invalid: true },
      {
        default: () => [
          h(FieldDescription, null, { default: () => 'Help' }),
          h(FieldDescription, null, { default: () => 'More help' }),
          h(FieldError, null, { default: () => 'Required' }),
          h(Input, { modelValue: '', 'onUpdate:modelValue': () => {} }),
        ],
      },
    ),
  );

  const input = root.querySelector('input');
  const describedBy = input?.getAttribute('aria-describedby') ?? '';
  const parts = describedBy.split(' ');
  expect(parts.length).toBe(3);
  expect(input?.getAttribute('aria-invalid')).toBe('true');
  app.unmount();
  root.remove();
});

test('valid fields omit error ids from the description', () => {
  const { app, root } = mount(
    h(Field, null, {
      default: () => [
        h(FieldDescription, null, { default: () => 'Help' }),
        h(FieldError, null, { default: () => 'Hidden' }),
        h(Input, { modelValue: '', 'onUpdate:modelValue': () => {} }),
      ],
    }),
  );

  const describedBy = root
    .querySelector('input')
    ?.getAttribute('aria-describedby');
  expect(describedBy?.split(' ').length).toBe(1);
  app.unmount();
  root.remove();
});

test('initial errors carry no role while live errors announce', () => {
  const { app, root } = mount(
    h(
      Field,
      { invalid: true },
      {
        default: () => [
          h(FieldError, null, { default: () => 'Initial' }),
          h(FieldError, { live: true }, { default: () => 'Dynamic' }),
        ],
      },
    ),
  );

  const errors = root.querySelectorAll('[data-slot="field-error"]');
  expect(errors[0].getAttribute('role')).toBe(null);
  expect(errors[1].getAttribute('role')).toBe('alert');
  app.unmount();
  root.remove();
});

test('multiple fields generate no duplicate ids', () => {
  const { app, root } = mount(
    h('div', null, [
      h(Field, null, {
        default: () => [
          h(FieldLabel, null, { default: () => 'One' }),
          h(Input, { modelValue: '', 'onUpdate:modelValue': () => {} }),
        ],
      }),
      h(Field, null, {
        default: () => [
          h(FieldLabel, null, { default: () => 'Two' }),
          h(Input, { modelValue: '', 'onUpdate:modelValue': () => {} }),
        ],
      }),
    ]),
  );

  const ids = [...root.querySelectorAll('[id]')].map((node) =>
    node.getAttribute('id'),
  );
  expect(new Set(ids).size).toBe(ids.length);
  app.unmount();
  root.remove();
});

test('disabled fieldsets disable nested controls', () => {
  const { app, root } = mount(
    h(
      FieldSet,
      { disabled: true },
      {
        default: () => [
          h(FieldLegend, null, { default: () => 'Group' }),
          h(Field, null, {
            default: () => [
              h(FieldLabel, null, { default: () => 'Name' }),
              h(Input, { modelValue: '', 'onUpdate:modelValue': () => {} }),
            ],
          }),
        ],
      },
    ),
  );

  expect(root.querySelector('fieldset')?.disabled).toBe(true);
  expect(root.querySelector('input')?.disabled).toBe(true);
  app.unmount();
  root.remove();
});

test('nested fields keep independent id graphs', () => {
  const { app, root } = mount(
    h(Field, null, {
      default: () => [
        h(FieldLabel, null, { default: () => 'Outer' }),
        h(Input, { modelValue: '', 'onUpdate:modelValue': () => {} }),
        h(Field, null, {
          default: () => [
            h(FieldLabel, null, { default: () => 'Inner' }),
            h(Checkbox, {
              checked: false,
              'onUpdate:checked': () => {},
            }),
          ],
        }),
      ],
    }),
  );

  const inputs = root.querySelectorAll('input');
  expect(inputs.length).toBe(2);
  expect(inputs[0].id).not.toBe(inputs[1].id);
  app.unmount();
  root.remove();
});

test('required and invalid state flow from the field', () => {
  const { app, root } = mount(
    h(
      Field,
      { invalid: true, required: true },
      {
        default: () => [
          h(FieldLabel, null, { default: () => 'Name' }),
          h(Input, { modelValue: '', 'onUpdate:modelValue': () => {} }),
        ],
      },
    ),
  );

  const input = root.querySelector('input');
  expect(input?.required).toBe(true);
  expect(input?.getAttribute('aria-invalid')).toBe('true');
  app.unmount();
  root.remove();
});

test('input-group addons place logically and keep the control named', async () => {
  const { app, root } = mount(
    h(Field, null, {
      default: () => [
        h(FieldLabel, null, { default: () => 'Amount' }),
        h(InputGroup, null, {
          default: () => [
            h(
              InputGroupAddon,
              { side: 'inline-start' },
              { default: () => '$' },
            ),
            h(InputGroupInput, {
              modelValue: '',
              'onUpdate:modelValue': () => {},
            }),
            h(
              InputGroupAddon,
              { side: 'inline-end' },
              { default: () => 'USD' },
            ),
          ],
        }),
      ],
    }),
  );
  await nextTick();

  const addons = root.querySelectorAll('[data-slot="input-group-addon"]');
  expect(addons[0].className).toContain('order-first');
  expect(addons[1].className).toContain('order-last');
  expect(addons[0].getAttribute('aria-hidden')).toBe('true');
  const label = root.querySelector('label');
  const input = root.querySelector('[data-slot="input-group-control"] input');
  expect(label?.getAttribute('for')).toBe(input?.id);
  app.unmount();
  root.remove();
});

test('input-group buttons keep their own accessible name', () => {
  const { app, root } = mount(
    h(InputGroup, null, {
      default: () => [
        h(InputGroupInput, {
          modelValue: '',
          'onUpdate:modelValue': () => {},
        }),
        h(
          InputGroupButton,
          { label: 'Apply discount' },
          { default: () => 'Apply' },
        ),
      ],
    }),
  );

  const button = root.querySelector('[data-slot="input-group-button"]');
  expect(button?.getAttribute('aria-label')).toBe('Apply discount');
  expect(button?.textContent).toContain('Apply');
  app.unmount();
  root.remove();
});

test('standalone controls render unchanged without a field', () => {
  const { app, root } = mount(
    h(Input, {
      inputId: 'solo',
      modelValue: '',
      'onUpdate:modelValue': () => {},
    }),
  );

  const input = root.querySelector('input');
  expect(input?.id).toBe('solo');
  expect(input?.getAttribute('aria-describedby')).toBe(null);
  expect(input?.getAttribute('aria-invalid')).toBe(null);
  app.unmount();
  root.remove();
});

test('field group exposes a group role', () => {
  const { app, root } = mount(
    h(FieldGroup, null, {
      default: () => h('span', null, 'child'),
    }),
  );

  expect(
    root.querySelector('[data-slot="field-group"]')?.getAttribute('role'),
  ).toBe('group');
  app.unmount();
  root.remove();
});
