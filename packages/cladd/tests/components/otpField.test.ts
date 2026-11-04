import { expect, test } from 'vite-plus/test';
import { h, ref } from 'vue';

import OTPField from '../../src/components/OTPField.vue';
import OTPFieldInput from '../../src/components/OTPFieldInput.vue';
import OTPFieldSeparator from '../../src/components/OTPFieldSeparator.vue';
import { byTestId, mountTree } from '../support/mountTree.ts';

function mountField(cells = 4) {
  const value = ref('');
  const mounted = mountTree(
    h(
      OTPField,
      {
        'data-testid': 'field',
        maxLength: cells,
        // Uncontrolled: `mountTree` renders a fixed vnode, so a `modelValue`
        // prop would never update and every keystroke would rebuild from ''.
        'onUpdate:modelValue': (next?: string) => (value.value = next ?? ''),
      },
      () =>
        Array.from({ length: cells }, (_unused, i) =>
          h(OTPFieldInput, { key: i }),
        ),
    ),
  );
  document.body.append(mounted.root);
  return { mounted, value };
}

function inputs(root: HTMLElement): HTMLInputElement[] {
  return [...root.querySelectorAll<HTMLInputElement>('input')];
}

function type(input: HTMLInputElement, char: string): void {
  input.value = char;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

test('renders one cell per OTPFieldInput and claims indexes in order', () => {
  const { mounted } = mountField(4);
  const cells = inputs(mounted.root);

  expect(cells).toHaveLength(4);
  expect(cells[0].getAttribute('autocomplete')).toBe('one-time-code');
  expect(cells[1].getAttribute('autocomplete')).toBe('off');
  expect(cells[0].getAttribute('maxlength')).toBe('1');
  expect(cells[0].getAttribute('inputmode')).toBe('numeric');
  expect(cells[0].getAttribute('pattern')).toBe('[0-9]');
  mounted.app.unmount();
  mounted.root.remove();
});

test('builds the value from typed characters and rejects the pattern', () => {
  const { mounted, value } = mountField(4);
  const cells = inputs(mounted.root);

  type(cells[0], '1');
  expect(value.value).toBe('1');

  type(cells[1], '2');
  expect(value.value).toBe('12');

  // Outside `[0-9]`, so the value is unchanged.
  type(cells[2], 'x');
  expect(value.value).toBe('12');
  mounted.app.unmount();
  mounted.root.remove();
});

test('generates cells from maxLength when no children are supplied', () => {
  const mounted = mountTree(
    h(OTPField, { 'data-testid': 'auto', maxLength: 6 }),
  );

  expect(inputs(mounted.root)).toHaveLength(6);
  mounted.app.unmount();
});

test('marks the field invalid and renders a separator like upstream', () => {
  const mounted = mountTree(
    h('div', null, [
      h(
        OTPField,
        { 'data-testid': 'invalid', maxLength: 2, valid: false },
        () => [h(OTPFieldInput), h(OTPFieldSeparator), h(OTPFieldInput)],
      ),
    ]),
  );

  const field = byTestId(mounted.root, 'invalid');
  expect(field.getAttribute('data-invalid')).toBe('true');
  expect(field.className).toContain('cladd-otp-field');

  const separator = field.querySelector('.cladd-otp-field-separator');
  expect(separator).not.toBeNull();
  expect(separator?.getAttribute('aria-hidden')).toBe('true');
  mounted.app.unmount();
});
