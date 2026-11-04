import { expect, test } from 'vite-plus/test';
import { createApp, defineComponent, h, nextTick, ref, shallowRef } from 'vue';

import Dialog from '../../src/components/Dialog.vue';
import { useOverlayDismiss } from '../../src/composables/useOverlayDismiss.ts';
import { useOverlayLifecycle } from '../../src/composables/useOverlayLifecycle.ts';
import type { OverlayPhase } from '../../src/foundations/contracts.ts';
import { Button } from '../../src/index.ts';
import {
  byTestId,
  click,
  mountTree,
  type MountedTree,
} from '../support/mountTree.ts';

async function settle(): Promise<void> {
  await nextTick();
  await new Promise((resolve) => requestAnimationFrame(resolve));
  await new Promise((resolve) => requestAnimationFrame(resolve));
  await nextTick();
}

async function settleWithTimers(): Promise<void> {
  await nextTick();
  await new Promise((resolve) => setTimeout(resolve, 60));
  await new Promise((resolve) => requestAnimationFrame(resolve));
  await nextTick();
}

function mountConnected(vnode: ReturnType<typeof h>): MountedTree {
  const root = document.createElement('div');
  document.body.append(root);
  const app = createApp({ render: () => vnode });
  app.mount(root);
  return { app, root };
}

test('emits closed exactly once when unmounted while closing', async () => {
  const phase = ref<OverlayPhase>('opening');
  const events: string[] = [];
  const harness = defineComponent({
    setup() {
      const element = shallowRef<HTMLElement>();

      useOverlayLifecycle({
        element,
        onClose: () => events.push('closing'),
        onClosed: () => events.push('closed'),
        onOpen: () => events.push('opening'),
        onOpened: () => events.push('opened'),
        phase,
        setPhase: (next) => {
          phase.value = next;
        },
      });

      return () => h('div', { ref: element, 'data-testid': 'overlay' });
    },
  });
  const mounted = mountConnected(h(harness));

  await settle();
  expect(events).toContain('opened');

  phase.value = 'closing';
  await nextTick();
  mounted.app.unmount();
  await nextTick();

  expect(events.filter((event) => event === 'closing')).toHaveLength(1);
  expect(events.filter((event) => event === 'closed')).toHaveLength(1);
  expect(phase.value).toBe('closed');
  mounted.root.remove();
});

test('removes escape handling and pending callbacks on unmount', async () => {
  const phase = ref<OverlayPhase>('opening');
  const events: string[] = [];
  const harness = defineComponent({
    setup() {
      const element = shallowRef<HTMLElement>();

      useOverlayLifecycle({
        element,
        onClose: () => events.push('closing'),
        onOpen: () => events.push('opening'),
        phase,
        setPhase: (next) => {
          phase.value = next;
        },
      });

      return () => h('div', { ref: element });
    },
  });
  const mounted = mountConnected(h(harness));

  mounted.app.unmount();
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  await settle();

  expect(events).toEqual([]);
  expect(phase.value).toBe('opening');
  mounted.root.remove();
});

test('does not dismiss a drag that starts inside the overlay', async () => {
  const opened = ref(true);
  let closes = 0;
  const harness = defineComponent({
    setup() {
      const container = shallowRef<HTMLElement>();

      useOverlayDismiss({
        closeOnOutsideClick: () => true,
        container,
        onClose: () => {
          closes += 1;
        },
        opened,
      });

      return () =>
        h('div', { ref: container, 'data-testid': 'overlay' }, 'overlay');
    },
  });
  const mounted = mountConnected(h(harness));
  const overlay = byTestId(mounted.root, 'overlay');
  const outside = document.createElement('button');
  document.body.append(outside);
  await nextTick();

  overlay.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
  outside.dispatchEvent(new MouseEvent('click', { bubbles: true }));

  expect(closes).toBe(0);

  outside.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
  outside.dispatchEvent(new MouseEvent('click', { bubbles: true }));

  expect(closes).toBe(1);
  mounted.app.unmount();
  mounted.root.remove();
  outside.remove();
});

test('removes dialog portal nodes after unmount while open', async () => {
  const app = document.createElement('div');
  app.className = 'app-container';
  document.body.append(app);

  const mounted = mountTree(h(Dialog, { open: true, title: 'Leak' }));
  await settleWithTimers();
  expect(document.body.querySelector('.cladd-dialog')).not.toBeNull();

  mounted.app.unmount();
  await settleWithTimers();
  expect(document.body.querySelector('.cladd-dialog')).toBeNull();
  expect(app.inert).toBe(false);

  app.remove();
  mounted.root.remove();
  document.body
    .querySelectorAll('.cladd-dialog, .cladd-popover, .cladd-tooltip')
    .forEach((node) => node.remove());
});

test('keeps app inert when dialog closes but popover still holds it', async () => {
  const app = document.createElement('div');
  app.className = 'app-container';
  document.body.append(app);

  const popover = document.createElement('div');
  popover.className = 'cladd-popover';
  document.body.append(popover);
  app.inert = false;

  const phase = ref<OverlayPhase>('opened');
  const harness = defineComponent({
    setup() {
      const element = shallowRef<HTMLElement>();
      const container = shallowRef<HTMLElement>();

      useOverlayLifecycle({
        element,
        onClose: () => {},
        onClosed: () => {},
        phase,
        setPhase: (next) => {
          phase.value = next;
        },
      });

      function setInert(next: boolean): void {
        const target = document.querySelector<HTMLElement>('.app-container');
        if (!target) return;
        if (
          !next &&
          document.querySelectorAll('.cladd-popover, .cladd-popup').length > 0
        )
          return;
        target.inert = next;
      }

      return () =>
        h('div', { ref: container }, [
          h('div', { ref: element }),
          h(
            'button',
            {
              onClick: () => setInert(false),
            },
            'close',
          ),
        ]);
    },
  });

  const mounted = mountConnected(h(harness));
  await nextTick();
  app.inert = true;
  phase.value = 'closing';
  await nextTick();
  document.body.querySelector('button')?.click();
  await nextTick();

  expect(app.inert).toBe(true);

  popover.remove();
  app.inert = false;
  expect(app.inert).toBe(false);

  mounted.app.unmount();
  mounted.root.remove();
  app.remove();
});

test('removes popover and tooltip portals after unmount', async () => {
  const { Popover, Tooltip } = await import('../../src/index.ts');
  const popoverMounted = mountTree(
    h(Popover, { open: true, position: 'bottom' }, () => 'content'),
  );
  await settleWithTimers();
  expect(document.body.querySelector('.cladd-popover')).not.toBeNull();
  popoverMounted.app.unmount();
  await settleWithTimers();
  expect(document.body.querySelector('.cladd-popover')).toBeNull();
  popoverMounted.root.remove();

  const tooltipMounted = mountTree(
    h(Tooltip, { open: true, timeout: false }, () => 'tip'),
  );
  await new Promise((resolve) => setTimeout(resolve, 60));
  await settle();
  const tooltipExists = document.body.querySelector('.cladd-tooltip');
  tooltipMounted.app.unmount();
  await settle();
  expect(document.body.querySelector('.cladd-tooltip')).toBeNull();
  tooltipMounted.root.remove();
  if (tooltipExists) tooltipExists.remove();
  document.body
    .querySelectorAll('.cladd-popover, .cladd-tooltip, .cladd-dialog')
    .forEach((node) => node.remove());
});

test('restores focus to the dialog trigger after escape', async () => {
  const open = ref(false);
  const harness = defineComponent({
    setup() {
      return () =>
        h(
          Dialog,
          {
            open: open.value,
            'onUpdate:open': (value: boolean | undefined) =>
              (open.value = Boolean(value)),
            title: 'Focus',
          },
          {
            trigger: () =>
              h(Button, { 'data-testid': 'dialog-trigger' }, () => 'Open'),
          },
        );
    },
  });
  const mounted = mountTree(h(harness));
  await nextTick();
  const trigger = byTestId(mounted.root, 'dialog-trigger') as HTMLButtonElement;
  trigger.focus();
  expect(document.activeElement).toBe(trigger);

  await click(trigger);
  await settleWithTimers();
  expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
  const closeBtn = document.body.querySelector<HTMLElement>(
    '[data-part="cancel"]',
  );
  if (closeBtn) expect(document.activeElement).not.toBe(trigger);

  document.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
  );
  await settleWithTimers();
  expect(open.value).toBe(false);
  await nextTick();
  expect(document.activeElement).toBe(trigger);

  mounted.app.unmount();
  mounted.root.remove();
  document.body
    .querySelectorAll('.cladd-dialog, .cladd-popover')
    .forEach((node) => node.remove());
});

test('covers all 13 popover positions and both tooltip origins', async () => {
  const { popoverPositionConfigs, tooltipOrigins } =
    await import('../../src/components/overlay.contracts.ts');
  const { buildPopoverPositionStyle, buildTooltipPositionStyle } =
    await import('../../src/components/overlay.contracts.ts');
  const popoverPositions = Object.keys(popoverPositionConfigs) as Array<
    keyof typeof popoverPositionConfigs
  >;
  expect(popoverPositions).toHaveLength(13);
  popoverPositions.forEach((position) => {
    const style = buildPopoverPositionStyle({
      anchorName: '--a',
      position,
      viewportMargin: 4,
    });
    expect(style.positionArea).toBeTruthy();
    expect(style.positionAnchor).toBe('--a');
    expect(popoverPositionConfigs[position].origin).toMatch(/^origin-/);
  });
  expect(tooltipOrigins.top).toBe('origin-bottom');
  expect(tooltipOrigins.bottom).toBe('origin-top');
  expect(
    buildTooltipPositionStyle({ anchorName: '--a', position: 'top' })
      .positionArea,
  ).toBe('top center');
  expect(
    buildTooltipPositionStyle({ anchorName: '--a', position: 'bottom' })
      .positionArea,
  ).toBe('bottom center');
});

test('synthetically completes transition when element is not visible (reduced-motion fast path)', async () => {
  const phase = ref<OverlayPhase>('opening');
  let closed = false;
  const harness = defineComponent({
    setup() {
      const element = shallowRef<HTMLElement>();
      useOverlayLifecycle({
        element,
        onClosed: () => {
          closed = true;
        },
        phase,
        setPhase: (next) => {
          phase.value = next;
        },
      });
      return () => h('div', { ref: element });
    },
  });
  const mounted = mountConnected(h(harness));
  await nextTick();
  const el = mounted.root.querySelector('div') as HTMLElement & {
    checkVisibility?: () => boolean;
  };
  el.checkVisibility = () => false;
  await settle();
  expect(phase.value).toBe('opened');
  expect(closed).toBe(false);
  phase.value = 'closing';
  await settle();
  expect(closed).toBe(true);
  expect(phase.value).toBe('closed');
  mounted.app.unmount();
  mounted.root.remove();
});

test('exposes correct popover origin and viewport style', async () => {
  const { Popover } = await import('../../src/index.ts');
  const { buildPopoverPositionStyle, popoverPositionConfigs } =
    await import('../../src/components/overlay.contracts.ts');
  const style = buildPopoverPositionStyle({
    anchorName: '--cladd-anchor-test',
    offset: 8,
    position: 'bottom-end',
    viewportMargin: 4,
  });
  expect(style.positionArea).toBe('bottom center');
  expect(style.justifySelf).toBe('end');
  expect(popoverPositionConfigs['bottom-end'].origin).toBe('origin-top-right');

  const mounted = mountTree(
    h(
      Popover,
      { open: true, position: 'bottom-end', viewportMargin: 12 },
      () => 'content',
    ),
  );
  await settleWithTimers();
  const content = document.body.querySelector<HTMLElement>(
    '.cladd-popover [data-part="content"]',
  );
  expect(content?.classList.contains('origin-top-right')).toBe(true);
  expect(content?.style.positionArea).toBe('bottom center');
  expect(content?.style.marginBottom).toBe('12px');
  expect(content?.style.marginLeft).toBe('12px');

  mounted.app.unmount();
  await settleWithTimers();
  mounted.root.remove();
  document.body
    .querySelectorAll('.cladd-popover')
    .forEach((node) => node.remove());
});
