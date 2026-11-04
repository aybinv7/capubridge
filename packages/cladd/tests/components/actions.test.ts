import { expect, test } from 'vite-plus/test';
import { defineComponent, h, nextTick, ref } from 'vue';

import ActionFixture from '../../fixtures/actions/ActionFixture.vue';
import { buttonSpinnerSizes } from '../../src/components/button.contracts.ts';
import {
  Button,
  Chip,
  Segmented,
  SegmentedButton,
  Shortcut,
  Spinner,
  ToggleButton,
  ToggleGroup,
  Toolbar,
  ToolbarButton,
  ToolbarSeparator,
} from '../../src/index.ts';
import { byTestId, click, mountTree } from '../support/mountTree.ts';

test('renders exact default button structure and loading replacement', () => {
  const mounted = mountTree(
    h(
      Button,
      { 'data-testid': 'button', loading: true },
      { default: () => 'Saving' },
    ),
  );
  const button = byTestId(mounted.root, 'button');

  expect(button.tagName).toBe('BUTTON');
  expect(button.classList.contains('h-cladd-md')).toBe(true);
  expect(button.classList.contains('rounded-cladd-md')).toBe(true);
  expect(button.classList.contains('group/cladd-button')).toBe(true);
  expect(button.getAttribute('aria-busy')).toBe('true');
  expect(button.textContent).toContain('Saving');
  expect(
    button
      .querySelector('.cladd-spinner')
      ?.classList.contains('size-cladd-nested-sm'),
  ).toBe(true);
  expect(button.querySelector('[data-part="focus-ring"]')).not.toBeNull();
  mounted.app.unmount();
});

test('blocks disabled and readonly button activation', async () => {
  let activations = 0;
  const disabled = mountTree(
    h(
      Button,
      { disabled: true, onClick: () => activations++ },
      { default: () => 'Disabled' },
    ),
  );
  const readonly = mountTree(
    h(
      Button,
      {
        as: 'a',
        href: '#target',
        onClick: () => activations++,
        readOnly: true,
      },
      { default: () => 'Readonly' },
    ),
  );

  await click(disabled.root.querySelector('button') as HTMLButtonElement);
  await click(readonly.root.querySelector('a') as HTMLAnchorElement);
  expect(activations).toBe(0);
  expect(readonly.root.querySelector('a')?.getAttribute('aria-disabled')).toBe(
    'true',
  );
  expect(readonly.root.querySelector('a')?.hasAttribute('data-disabled')).toBe(
    false,
  );
  expect(
    disabled.root.querySelector('button')?.getAttribute('data-disabled'),
  ).toBe('true');
  expect(
    disabled.root
      .querySelector('button')
      ?.classList.contains('pointer-events-none'),
  ).toBe(true);
  disabled.app.unmount();
  readonly.app.unmount();
});

test('matches Cladd button color and content layer API', () => {
  const mounted = mountTree(
    h(
      Button,
      {
        color: 'orange',
        contentClassName: 'button-content-contract',
        square: true,
      },
      { default: () => h('svg', { 'data-testid': 'button-icon' }) },
    ),
  );
  const button = mounted.root.querySelector('.cladd-button') as HTMLElement;

  expect(button.classList.contains('cladd-color-orange')).toBe(true);
  expect(button.querySelector('.button-content-contract')).not.toBeNull();
  expect(button.querySelector('[data-testid="button-icon"]')).not.toBeNull();
  expect(button.hasAttribute('aria-label')).toBe(false);
  mounted.app.unmount();
});

test('emits the Cladd button state attributes', () => {
  const mounted = mountTree(
    h(Button, { loading: true, pressed: true, readOnly: true }),
  );
  const button = mounted.root.querySelector('.cladd-button') as HTMLElement;

  expect(button.getAttribute('data-pressed')).toBe('true');
  expect(button.getAttribute('data-loading')).toBe('true');
  expect(button.getAttribute('data-readonly')).toBe('true');
  mounted.app.unmount();
});

test('forwards disabled to a polymorphic non-button target', () => {
  const mounted = mountTree(h(Button, { as: 'a', disabled: true, href: '#' }));
  const anchor = mounted.root.querySelector('.cladd-button') as HTMLElement;

  // Upstream always passes `disabled={disabled || readOnly}` through to
  // whatever tag `as` renders, native button or not (`Button.tsx:~215`).
  expect(anchor.tagName).toBe('A');
  expect(anchor.getAttribute('disabled')).not.toBeNull();
  mounted.app.unmount();
});

test('scopes the accent text hook to non-neutral colors like Cladd', () => {
  const neutral = mountTree(h(Button, { color: 'neutral' }));
  const accented = mountTree(h(Button, { color: 'orange' }));
  const inherited = mountTree(h(Button));

  // Upstream conditions the accent text color on the *explicit* prop, not the neutral default
  // or an inherited theme accent — expressed as a class, not a data attribute (Button.tsx:194-197).
  expect(
    neutral.root
      .querySelector('.cladd-button')
      ?.classList.contains('text-cladd-primary'),
  ).toBe(false);
  expect(
    accented.root
      .querySelector('.cladd-button')
      ?.classList.contains('text-cladd-primary'),
  ).toBe(true);
  expect(
    inherited.root
      .querySelector('.cladd-button')
      ?.classList.contains('text-cladd-primary'),
  ).toBe(false);

  neutral.app.unmount();
  accented.app.unmount();
  inherited.app.unmount();
});

test('maps every button size to Cladd spinner geometry', () => {
  expect(buttonSpinnerSizes).toEqual({
    '2xs': '2xs',
    xs: '2xs',
    sm: 'xs',
    md: 'sm',
    lg: 'md',
    xl: 'lg',
    '2xl': 'xl',
  });
});

test('makes anchor and button chips interactive automatically', () => {
  const mounted = mountTree(
    h('div', null, [
      h(
        Chip,
        { as: 'a', 'data-testid': 'anchor', href: '#target' },
        () => 'Docs',
      ),
      h(Chip, { 'data-testid': 'label' }, () => 'Draft'),
    ]),
  );

  expect(
    byTestId(mounted.root, 'anchor').classList.contains('cladd-clickable'),
  ).toBe(true);
  expect(
    byTestId(mounted.root, 'label').classList.contains('cladd-clickable'),
  ).toBe(false);
  mounted.app.unmount();
});

test('matches Cladd chip API and geometry contracts', () => {
  const mounted = mountTree(
    h(
      Chip,
      {
        as: 'button',
        color: 'green',
        contentClassName: 'chip-content-contract',
        disabled: true,
        icon: { render: () => h('svg', { 'data-testid': 'chip-icon' }) },
        rounded: true,
      },
      () => 'Verified',
    ),
  );
  const chip = mounted.root.querySelector('.cladd-chip') as HTMLElement;

  expect(chip.tagName).toBe('BUTTON');
  expect(chip.classList.contains('rounded-full')).toBe(true);
  expect(chip.classList.contains('group/cladd-chip')).toBe(true);
  expect(chip.classList.contains('h-cladd-nested-md')).toBe(true);
  expect(chip.classList.contains('text-cladd-2xs')).toBe(true);
  expect(chip.hasAttribute('disabled')).toBe(false);
  expect(chip.querySelector('.chip-content-contract')).not.toBeNull();
  expect(chip.querySelector('[data-testid="chip-icon"]')).not.toBeNull();
  expect(chip.classList.contains('cladd-color-green')).toBe(true);
  mounted.app.unmount();
});

test('matches Cladd spinner API and SVG contract', () => {
  const mounted = mountTree(
    h(Spinner, {
      class: 'spinner-contract',
      color: 'purple',
      size: '2xl',
    }),
  );
  const spinner = mounted.root.querySelector('.cladd-spinner') as HTMLElement;

  expect(spinner.classList.contains('spinner-contract')).toBe(true);
  expect(spinner.classList.contains('cladd-color-purple')).toBe(true);
  expect(spinner.classList.contains('size-cladd-nested-2xl')).toBe(true);
  expect(spinner.hasAttribute('aria-hidden')).toBe(false);
  expect(spinner.querySelector('svg')?.getAttribute('viewBox')).toBe(
    '0 0 20 20',
  );
  expect(spinner.querySelector('path')?.getAttribute('d')).toContain(
    'M9.045 2.078',
  );
  mounted.app.unmount();
});

test('splits shortcuts and renders platform key treatment', () => {
  const mounted = mountTree(
    h(Shortcut, { 'data-testid': 'shortcut' }, () => 'ctrl shift k'),
  );
  const shortcut = byTestId(mounted.root, 'shortcut');
  const keys = shortcut.querySelectorAll('[data-part="key"]');

  expect(keys).toHaveLength(3);
  expect(keys[0]?.textContent).toBe('CTRL');
  expect(keys[1]?.querySelector('svg')).not.toBeNull();
  expect(keys[2]?.textContent).toBe('K');
  mounted.app.unmount();
});

test('matches Cladd shortcut key customization and fill contracts', () => {
  const mounted = mountTree(
    h(
      Shortcut,
      {
        color: 'brand',
        iconClassName: 'shortcut-icon-contract',
        keyClassName: 'shortcut-key-contract',
        keyContentClassName: 'shortcut-content-contract',
        variant: 'solid-fill',
      },
      () => 'shift k',
    ),
  );
  const keys = mounted.root.querySelectorAll<HTMLElement>(
    '.cladd-shortcut__key',
  );

  expect(keys).toHaveLength(2);
  expect(keys[0]?.classList.contains('shortcut-key-contract')).toBe(true);
  expect(keys[0]?.classList.contains('cladd-color-brand')).toBe(true);
  expect(keys[0]?.querySelector('.shortcut-content-contract')).not.toBeNull();
  expect(keys[0]?.querySelector('.shortcut-icon-contract')).not.toBeNull();
  expect(keys[0]?.classList.contains('text-cladd-on-primary')).toBe(true);
  mounted.app.unmount();
});

test('scopes Segmented sizing and rounding through context to its buttons', () => {
  const mounted = mountTree(
    h(
      Segmented,
      { 'data-testid': 'segmented', rounded: false, size: 'lg' },
      () => [
        h(
          SegmentedButton,
          { active: true, 'data-testid': 'active-segment' },
          () => 'Grid',
        ),
        h(SegmentedButton, { 'data-testid': 'inactive-segment' }, () => 'List'),
      ],
    ),
  );
  const active = byTestId(mounted.root, 'active-segment');
  const inactive = byTestId(mounted.root, 'inactive-segment');

  expect(active.classList.contains('h-cladd-lg')).toBe(true);
  expect(active.classList.contains('rounded-cladd-lg')).toBe(true);
  expect(active.getAttribute('data-active')).toBe('true');
  expect(active.getAttribute('data-readonly')).toBe('true');
  expect(inactive.getAttribute('data-active')).toBeNull();
  mounted.app.unmount();
});

test('applies the active color/variant/outline only to the selected segment', () => {
  const mounted = mountTree(
    h(
      Segmented,
      {
        color: 'neutral',
        outline: false,
        'data-testid': 'segmented',
        variant: 'transparent',
      },
      () => [
        h(
          SegmentedButton,
          { active: true, 'data-testid': 'active-segment' },
          () => 'Grid',
        ),
        h(SegmentedButton, { 'data-testid': 'inactive-segment' }, () => 'List'),
      ],
    ),
  );
  const active = byTestId(mounted.root, 'active-segment');
  const inactive = byTestId(mounted.root, 'inactive-segment');

  // Active segment defaults to the theme accent + gradient + outline (Segmented.tsx:80-88).
  expect(active.querySelector('.shadow-cladd-outline')).not.toBeNull();
  // Inactive segments stay on the group's own inactive color/variant/outline.
  expect(inactive.querySelector('.shadow-cladd-outline')).toBeNull();
  mounted.app.unmount();
});

test('lets an explicit SegmentedButton prop win over the segment context', () => {
  const mounted = mountTree(
    h(Segmented, null, () =>
      h(
        SegmentedButton,
        { 'data-testid': 'segment', size: 'sm' },
        () => 'Grid',
      ),
    ),
  );
  const segment = byTestId(mounted.root, 'segment');

  // Segmented's own default is 'md'; the button's explicit size wins (SegmentedButton.tsx spreads
  // `...rest` after the context-derived attributes).
  expect(segment.classList.contains('h-cladd-sm')).toBe(true);
  mounted.app.unmount();
});

test('forwards Toolbar size/rounded to ToolbarButton via context, and lets an explicit prop win', () => {
  const mounted = mountTree(
    h(Toolbar, { 'data-testid': 'toolbar', size: 'lg' }, () => [
      h(ToolbarButton, { 'data-testid': 'tb-default' }, () => 'Copy'),
      h(
        ToolbarButton,
        { 'data-testid': 'tb-explicit', size: 'sm' },
        () => 'Paste',
      ),
      h(ToolbarSeparator, { 'data-testid': 'tb-separator' }),
    ]),
  );

  expect(
    byTestId(mounted.root, 'tb-default').classList.contains('h-cladd-lg'),
  ).toBe(true);
  expect(
    byTestId(mounted.root, 'tb-explicit').classList.contains('h-cladd-sm'),
  ).toBe(true);
  expect(
    byTestId(mounted.root, 'tb-separator').classList.contains(
      'cladd-toolbar-separator',
    ),
  ).toBe(true);
  mounted.app.unmount();
});

test('ToggleGroup selects a single value and clicking the active one clears it', async () => {
  const mounted = mountTree(
    h(ToggleGroup, { defaultValue: 'grid' }, () => [
      h(ToggleButton, { 'data-testid': 'grid', value: 'grid' }, () => 'Grid'),
      h(ToggleButton, { 'data-testid': 'list', value: 'list' }, () => 'List'),
    ]),
  );

  expect(byTestId(mounted.root, 'grid').getAttribute('aria-pressed')).toBe(
    'true',
  );
  expect(byTestId(mounted.root, 'list').getAttribute('aria-pressed')).toBe(
    'false',
  );

  await click(byTestId(mounted.root, 'list'));
  expect(byTestId(mounted.root, 'grid').getAttribute('aria-pressed')).toBe(
    'false',
  );
  expect(byTestId(mounted.root, 'list').getAttribute('aria-pressed')).toBe(
    'true',
  );

  await click(byTestId(mounted.root, 'list'));
  expect(byTestId(mounted.root, 'list').getAttribute('aria-pressed')).toBe(
    'false',
  );
  mounted.app.unmount();
});

test('ToggleGroup stays controlled when its bound value clears to undefined', async () => {
  const value = ref<string | undefined>('grid');
  const harness = defineComponent({
    setup() {
      return () =>
        h(
          ToggleGroup,
          {
            'onUpdate:value': (next: string | string[] | undefined) =>
              (value.value = next as string | undefined),
            value: value.value,
          },
          () => [
            h(
              ToggleButton,
              { 'data-testid': 'grid', value: 'grid' },
              () => 'Grid',
            ),
            h(
              ToggleButton,
              { 'data-testid': 'list', value: 'list' },
              () => 'List',
            ),
          ],
        );
    },
  });
  const mounted = mountTree(h(harness));

  // Clearing the bound value to `undefined` (an empty selection) must not
  // flip the group to uncontrolled — clicking afterward should still update
  // the parent's ref rather than silently falling back to internal state.
  value.value = undefined;
  await nextTick();
  expect(byTestId(mounted.root, 'grid').getAttribute('aria-pressed')).toBe(
    'false',
  );

  await click(byTestId(mounted.root, 'list'));
  expect(value.value).toBe('list');
  expect(byTestId(mounted.root, 'list').getAttribute('aria-pressed')).toBe(
    'true',
  );
  mounted.app.unmount();
});

test('ToggleGroup with multiple keeps every pressed button pressed independently', async () => {
  const mounted = mountTree(
    h(ToggleGroup, { multiple: true }, () => [
      h(ToggleButton, { 'data-testid': 'bold', value: 'bold' }, () => 'Bold'),
      h(
        ToggleButton,
        { 'data-testid': 'italic', value: 'italic' },
        () => 'Italic',
      ),
    ]),
  );

  await click(byTestId(mounted.root, 'bold'));
  await click(byTestId(mounted.root, 'italic'));
  expect(byTestId(mounted.root, 'bold').getAttribute('aria-pressed')).toBe(
    'true',
  );
  expect(byTestId(mounted.root, 'italic').getAttribute('aria-pressed')).toBe(
    'true',
  );
  mounted.app.unmount();
});

test('a standalone ToggleButton owns its own pressed state', async () => {
  const mounted = mountTree(
    h(ToggleButton, { 'data-testid': 'pin' }, () => 'Pin'),
  );

  expect(byTestId(mounted.root, 'pin').getAttribute('aria-pressed')).toBe(
    'false',
  );
  await click(byTestId(mounted.root, 'pin'));
  await nextTick();
  expect(byTestId(mounted.root, 'pin').getAttribute('aria-pressed')).toBe(
    'true',
  );
  mounted.app.unmount();
});

test('renders every pixel-contract fixture size and state', () => {
  const mounted = mountTree(h(ActionFixture));

  expect(
    mounted.root.querySelectorAll('.cladd-action-fixture__row'),
  ).toHaveLength(8);
  expect(mounted.root.querySelectorAll('.cladd-button').length).toBeGreaterThan(
    20,
  );
  expect(mounted.root.querySelectorAll('.cladd-chip')).toHaveLength(7);
  expect(mounted.root.querySelectorAll('.cladd-shortcut')).toHaveLength(7);
  expect(
    mounted.root.querySelectorAll('.cladd-spinner').length,
  ).toBeGreaterThan(7);
  expect(
    mounted.root.querySelectorAll('.cladd-surface-level-5').length,
  ).toBeGreaterThan(1);
  mounted.app.unmount();
});
