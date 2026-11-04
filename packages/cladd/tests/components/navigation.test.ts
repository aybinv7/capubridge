import { expect, test } from 'vite-plus/test';
import { defineComponent, h, nextTick, ref } from 'vue';

import { Tab, TabPanel, Tabs, TabsList } from '../../src/index.ts';
import { byTestId, click, mountTree } from '../support/mountTree.ts';

function mountTabs(defaultValue = 'overview') {
  return mountTree(
    h(Tabs, { defaultValue }, () => [
      h(TabsList, { 'data-testid': 'tabs-list' }, () => [
        h(
          Tab,
          { 'data-testid': 'tab-overview', value: 'overview' },
          () => 'Overview',
        ),
        h(
          Tab,
          { 'data-testid': 'tab-activity', value: 'activity' },
          () => 'Activity',
        ),
      ]),
      h(
        TabPanel,
        { 'data-testid': 'panel-overview', value: 'overview' },
        () => 'Overview content',
      ),
      h(
        TabPanel,
        { 'data-testid': 'panel-activity', value: 'activity' },
        () => 'Activity content',
      ),
    ]),
  );
}

test('selects the default tab and mounts only its panel', () => {
  const mounted = mountTabs();

  const overviewTab = byTestId(mounted.root, 'tab-overview');
  const activityTab = byTestId(mounted.root, 'tab-activity');

  expect(overviewTab.getAttribute('aria-selected')).toBe('true');
  expect(overviewTab.getAttribute('tabindex')).toBe('0');
  expect(activityTab.getAttribute('aria-selected')).toBe('false');
  expect(activityTab.getAttribute('tabindex')).toBe('-1');

  expect(
    mounted.root.querySelector('[data-testid="panel-overview"]'),
  ).not.toBeNull();
  expect(
    mounted.root.querySelector('[data-testid="panel-activity"]'),
  ).toBeNull();
  mounted.app.unmount();
});

test('switches the selected tab and panel on click', async () => {
  const mounted = mountTabs();

  await click(byTestId(mounted.root, 'tab-activity'));

  expect(
    byTestId(mounted.root, 'tab-activity').getAttribute('aria-selected'),
  ).toBe('true');
  expect(
    byTestId(mounted.root, 'tab-overview').getAttribute('aria-selected'),
  ).toBe('false');
  expect(
    mounted.root.querySelector('[data-testid="panel-activity"]')?.textContent,
  ).toBe('Activity content');
  expect(
    mounted.root.querySelector('[data-testid="panel-overview"]'),
  ).toBeNull();
  mounted.app.unmount();
});

test('moves selection with arrow keys and wraps at the ends', async () => {
  const mounted = mountTabs();
  const list = byTestId(mounted.root, 'tabs-list');
  const overviewTab = byTestId(mounted.root, 'tab-overview') as HTMLElement;
  overviewTab.focus();

  list.dispatchEvent(
    new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowRight' }),
  );
  await nextTick();
  expect(
    byTestId(mounted.root, 'tab-activity').getAttribute('aria-selected'),
  ).toBe('true');

  list.dispatchEvent(
    new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowRight' }),
  );
  await nextTick();
  expect(
    byTestId(mounted.root, 'tab-overview').getAttribute('aria-selected'),
  ).toBe('true');
  mounted.app.unmount();
});

test('keeps an inactive panel mounted (but hidden) when keepMounted is set', () => {
  const mounted = mountTree(
    h(Tabs, { defaultValue: 'overview' }, () => [
      h(
        TabPanel,
        { 'data-testid': 'panel-overview', value: 'overview' },
        () => 'Overview',
      ),
      h(
        TabPanel,
        {
          'data-testid': 'panel-activity',
          keepMounted: true,
          value: 'activity',
        },
        () => 'Activity',
      ),
    ]),
  );
  const activityPanel = byTestId(mounted.root, 'panel-activity');

  expect(activityPanel).not.toBeNull();
  expect(activityPanel.hasAttribute('hidden')).toBe(true);
  mounted.app.unmount();
});

test('supports controlled selection through value/update:value', async () => {
  const value = ref('overview');
  const harness = defineComponent({
    setup() {
      return () =>
        h(
          Tabs,
          {
            'onUpdate:value': (next: string) => (value.value = next),
            value: value.value,
          },
          () => [
            h(TabsList, () => [
              h(
                Tab,
                { 'data-testid': 'tab-overview', value: 'overview' },
                () => 'Overview',
              ),
              h(
                Tab,
                { 'data-testid': 'tab-activity', value: 'activity' },
                () => 'Activity',
              ),
            ]),
          ],
        );
    },
  });
  const mounted = mountTree(h(harness));

  await click(byTestId(mounted.root, 'tab-activity'));
  expect(value.value).toBe('activity');
  mounted.app.unmount();
});
