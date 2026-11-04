import { expect, test } from 'vite-plus/test';
import { defineComponent, h } from 'vue';

import NavRail from '../../src/components/NavRail.vue';
import NavRailItem from '../../src/components/NavRailItem.vue';
import { mountTree } from '../support/mountTree.ts';

function icon() {
  return h('svg', { 'data-testid': 'icon' });
}

function item(props: Record<string, unknown>, slots = {}) {
  return h(NavRailItem, props, { icon, ...slots });
}

function items(root: HTMLElement) {
  return Array.from(root.querySelectorAll<HTMLElement>('.cladd-nav-rail-item'));
}

test('renders a named nav root with labelled items', () => {
  const { app, root } = mountTree(
    h(
      NavRail,
      { 'aria-label': 'Main' },
      {
        default: () => [
          item({ label: 'Device', href: '#device' }),
          item({ label: 'Data', href: '#data' }),
        ],
      },
    ),
  );

  const nav = root.querySelector('nav');
  expect(nav?.getAttribute('aria-label')).toBe('Main');
  expect(nav?.hasAttribute('data-labels')).toBe(true);
  expect(nav?.className).toContain('w-16');

  const [device] = items(root);
  expect(device.tagName).toBe('A');
  expect(device.getAttribute('href')).toBe('#device');
  expect(device.className).toContain('h-12.5');
  expect(device.className).toContain('w-13.5');
  expect(
    device.querySelector('[data-slot="nav-rail-item-label"]')?.textContent,
  ).toContain('Device');
  expect(device.hasAttribute('aria-label')).toBe(false);
  app.unmount();
  root.remove();
});

test('a compact rail hides labels and names items with aria-label', () => {
  const { app, root } = mountTree(
    h(
      NavRail,
      { labels: false },
      { default: () => [item({ label: 'Network' })] },
    ),
  );

  const nav = root.querySelector('nav');
  expect(nav?.className).toContain('w-12');
  expect(nav?.hasAttribute('data-labels')).toBe(false);

  const [network] = items(root);
  expect(network.className).toContain('size-10');
  expect(network.getAttribute('aria-label')).toBe('Network');
  expect(network.querySelector('[data-slot="nav-rail-item-label"]')).toBe(null);
  app.unmount();
  root.remove();
});

test('hideLabel keeps the labelled size but moves the name to aria-label', () => {
  const { app, root } = mountTree(
    h(NavRail, null, {
      default: () => [item({ label: 'Settings', hideLabel: true })],
    }),
  );

  const [settings] = items(root);
  expect(settings.className).toContain('h-12.5');
  expect(settings.getAttribute('aria-label')).toBe('Settings');
  expect(settings.querySelector('[data-slot="nav-rail-item-label"]')).toBe(
    null,
  );
  app.unmount();
  root.remove();
});

test('only the active item is current, raised and bevelled', () => {
  const { app, root } = mountTree(
    h(NavRail, null, {
      default: () => [
        item({ label: 'Device' }),
        item({ label: 'Data', active: true }),
        item({ label: 'Replay', active: true, current: 'location' }),
      ],
    }),
  );

  const [device, data, replay] = items(root);
  expect(device.hasAttribute('aria-current')).toBe(false);
  expect(device.hasAttribute('data-active')).toBe(false);
  expect(device.className).toContain('text-cladd-fg-softer');
  expect(
    device
      .querySelector('.cladd-surface__background')
      ?.classList.contains('shadow-cladd-outline'),
  ).toBe(false);

  expect(data.getAttribute('aria-current')).toBe('page');
  expect(data.hasAttribute('data-active')).toBe(true);
  expect(data.classList.contains('cladd-surface-level-2')).toBe(true);
  expect(data.className).toContain('font-medium');
  const background = data.querySelector('.cladd-surface__background');
  expect(background?.classList.contains('bg-cladd-surface')).toBe(true);
  expect(background?.classList.contains('shadow-cladd-outline')).toBe(true);

  expect(replay.getAttribute('aria-current')).toBe('location');
  app.unmount();
  root.remove();
});

test('renders a polymorphic root and forwards its attributes', () => {
  const RouterLinkStub = defineComponent({
    props: { to: { type: String, required: true } },
    setup(props, { slots }) {
      return () => h('a', { href: props.to }, slots.default?.());
    },
  });

  const { app, root } = mountTree(
    h(NavRail, null, {
      default: () => [
        item({ as: RouterLinkStub, to: '/storage', label: 'Data' }),
      ],
    }),
  );

  const link = root.querySelector('a');
  expect(link?.getAttribute('href')).toBe('/storage');
  expect(link?.textContent).toContain('Data');
  app.unmount();
  root.remove();
});

test('the footer is pinned after the items and the indicator slot renders', () => {
  const { app, root } = mountTree(
    h(NavRail, null, {
      default: () => [item({ label: 'Device' })],
      footer: () => [
        item(
          { label: 'Console', hideLabel: true },
          { indicator: () => h('span', { 'data-testid': 'unread' }) },
        ),
      ],
    }),
  );

  const footer = root.querySelector('[data-slot="nav-rail-footer"]');
  expect(footer?.className).toContain('mt-auto');
  expect(footer?.querySelector('.cladd-nav-rail-item')).not.toBe(null);
  expect(
    footer?.querySelector(
      '[data-slot="nav-rail-item-indicator"] [data-testid="unread"]',
    ),
  ).not.toBe(null);
  app.unmount();
  root.remove();
});

test('an item outside a rail shows its label', () => {
  const { app, root } = mountTree(item({ label: 'Flows' }));

  const [flows] = items(root);
  expect(flows.className).toContain('h-12.5');
  expect(
    flows.querySelector('[data-slot="nav-rail-item-label"]')?.textContent,
  ).toContain('Flows');
  app.unmount();
  root.remove();
});

test('disabled items are marked and leave pointer interaction', () => {
  const { app, root } = mountTree(
    h(NavRail, null, {
      default: () => [item({ label: 'Elements', disabled: true })],
    }),
  );

  const [elements] = items(root);
  expect(elements.hasAttribute('data-disabled')).toBe(true);
  expect(elements.getAttribute('aria-disabled')).toBe('true');
  expect(elements.className).toContain('pointer-events-none');
  app.unmount();
  root.remove();
});
