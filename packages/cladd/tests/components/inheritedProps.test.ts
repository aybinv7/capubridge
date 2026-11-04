import { expect, test } from 'vite-plus/test';
import { defineComponent, h, nextTick, ref } from 'vue';

import ColorPicker from '../../src/components/ColorPicker.vue';
import Popover from '../../src/components/Popover.vue';
import Select from '../../src/components/Select.vue';
import Textarea from '../../src/components/Textarea.vue';
import VNodeRenderer from '../../src/components/VNodeRenderer.ts';
import { Backdrop, CladdProvider } from '../../src/index.ts';
import type { ComponentDefaults } from '../../src/index.ts';
import { byTestId, mountTree } from '../support/mountTree.ts';

test('forwards inherited Button props through ColorPicker and Select', () => {
  const mounted = mountTree(
    h('div', null, [
      h(ColorPicker, {
        as: 'a',
        clickable: true,
        focusable: false,
        hoverable: false,
        loading: true,
        pressed: true,
        square: true,
        surfaceLevel: 3,
        tightFocusRing: true,
        variant: 'transparent',
        'data-testid': 'color',
      }),
      h(Select, {
        as: 'a',
        clickable: true,
        focusable: false,
        loading: true,
        square: true,
        surfaceLevel: 3,
        'data-testid': 'select',
      }),
    ]),
  );

  const color = byTestId(mounted.root, 'color');
  const select = byTestId(mounted.root, 'select');

  expect(color.tagName).toBe('A');
  expect(color.getAttribute('data-loading')).toBe('true');
  expect(color.getAttribute('data-pressed')).toBe('true');
  expect(color.classList.contains('aspect-square')).toBe(true);
  expect(color.classList.contains('cladd-surface-level-3')).toBe(true);
  expect(select.tagName).toBe('A');
  expect(select.getAttribute('data-loading')).toBe('true');
  expect(select.classList.contains('aspect-square')).toBe(true);
  expect(select.classList.contains('cladd-surface-level-3')).toBe(true);
  mounted.app.unmount();
});

test('renders every VNodeChild form without string coercion', () => {
  const mounted = mountTree(
    h('div', null, [
      h(VNodeRenderer, { node: 'plain text' }),
      h(VNodeRenderer, {
        node: h('strong', { 'data-testid': 'node' }, 'node'),
      }),
      h(VNodeRenderer, { node: ['first', h('em', 'second')] }),
    ]),
  );

  expect(mounted.root.textContent).toContain('plain text');
  expect(byTestId(mounted.root, 'node').textContent).toBe('node');
  expect(mounted.root.textContent).toContain('firstsecond');
  mounted.app.unmount();
});

test('exposes primitive class defaults through CladdProvider types and runtime', () => {
  const defaults = {
    Backdrop: { className: 'provider-backdrop' },
    List: { className: 'provider-list' },
    ListItem: { className: 'provider-list-item' },
    ListSeparator: { className: 'provider-list-separator' },
    ListTitle: { className: 'provider-list-title' },
    OTPFieldSeparator: { className: 'provider-otp-separator' },
    SectionTitle: { className: 'provider-section-title' },
    ToolbarSeparator: { className: 'provider-toolbar-separator' },
  } satisfies ComponentDefaults;
  const mounted = mountTree(
    h(
      CladdProvider,
      { defaults },
      {
        default: () => h(Backdrop, { 'data-testid': 'backdrop' }),
      },
    ),
  );

  expect(
    byTestId(mounted.root, 'backdrop').classList.contains('provider-backdrop'),
  ).toBe(true);
  mounted.app.unmount();
});

test('forwards inherited Surface props through Textarea', () => {
  const mounted = mountTree(
    h(Textarea, {
      bgClassName: 'textarea-background',
      clickable: true,
      outline: false,
      overlayClassName: 'textarea-overlay',
      overlayPosition: 'below',
      pressed: true,
      'data-testid': 'textarea',
    }),
  );
  const textarea = byTestId(mounted.root, 'textarea');

  expect(textarea.classList.contains('cladd-clickable')).toBe(true);
  expect(textarea.querySelector('.textarea-background')).not.toBeNull();
  expect(textarea.querySelector('.textarea-overlay')).not.toBeNull();
  expect(textarea.querySelector('.shadow-cladd-cut-outline')).toBeNull();
  mounted.app.unmount();
});

test('forwards inherited Surface props through Popover', async () => {
  const open = ref(false);
  const Harness = defineComponent({
    setup() {
      return () =>
        h(Popover, {
          as: 'section',
          bgClassName: 'popover-background',
          clickable: true,
          open: open.value,
          outline: false,
          overlayClassName: 'popover-overlay',
          overlayPosition: 'below',
          pressed: true,
          root: false,
          wrapContent: false,
          'data-testid': 'popover',
        });
    },
  });
  const mounted = mountTree(h(Harness));

  open.value = true;
  await nextTick();
  await nextTick();

  const popover = byTestId(mounted.root, 'popover');
  expect(popover.tagName).toBe('SECTION');
  expect(popover.classList.contains('cladd-clickable')).toBe(true);
  expect(popover.querySelector('.popover-background')).not.toBeNull();
  expect(popover.querySelector('.popover-overlay')).not.toBeNull();
  expect(popover.querySelector('.shadow-cladd-outline')).toBeNull();
  mounted.app.unmount();
});
