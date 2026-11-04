import { expect, test } from 'vite-plus/test';
import { h } from 'vue';

import Button from '../../src/components/Button.vue';
import Checkbox from '../../src/components/Checkbox.vue';
import Chip from '../../src/components/Chip.vue';
import FocusRing from '../../src/components/FocusRing.vue';
import Input from '../../src/components/Input.vue';
import NumberScrubber from '../../src/components/NumberScrubber.vue';
import Radio from '../../src/components/Radio.vue';
import Segmented from '../../src/components/Segmented.vue';
import Shortcut from '../../src/components/Shortcut.vue';
import Surface from '../../src/components/Surface.vue';
import Switch from '../../src/components/Switch.vue';
import Textarea from '../../src/components/Textarea.vue';
import { byTestId, mountTree } from '../support/mountTree.ts';

/**
 * Upstream puts the consumer's `className` last in every component's `cn(...)`,
 * so a consumer utility beats the component's own. The port used to forward
 * `class` through `$attrs` instead, where tailwind-merge resolved it the wrong
 * way round and silently dropped it.
 *
 * Each case pairs a conflicting utility with the class the component sets.
 */
const cases = [
  {
    component: Button,
    name: 'Button',
    win: 'cursor-ew-resize',
    lose: 'cursor-auto',
  },
  {
    component: Chip,
    name: 'Chip',
    win: 'cursor-ew-resize',
    lose: 'cursor-auto',
  },
  {
    component: Checkbox,
    name: 'Checkbox',
    win: 'rounded-none',
    lose: 'rounded-full',
  },
  {
    component: Radio,
    name: 'Radio',
    win: 'rounded-none',
    lose: 'rounded-full',
  },
  {
    component: Switch,
    name: 'Switch',
    win: 'rounded-none',
    lose: 'rounded-full',
  },
  { component: Segmented, name: 'Segmented', win: 'block', lose: 'flex' },
  { component: Shortcut, name: 'Shortcut', win: 'block', lose: 'inline-flex' },
  {
    component: NumberScrubber,
    name: 'NumberScrubber',
    win: 'cursor-default',
    lose: 'cursor-ew-resize',
  },
  { component: Surface, name: 'Surface', win: 'static', lose: 'relative' },
  {
    component: Input,
    name: 'Input',
    win: 'opacity-100',
    lose: 'opacity-50',
    props: { disabled: true },
  },
  {
    component: Textarea,
    name: 'Textarea',
    win: 'opacity-100',
    lose: 'opacity-50',
    props: { disabled: true },
  },
  {
    component: FocusRing,
    name: 'FocusRing',
    win: 'inset-4',
    lose: 'inset-0',
    props: { offset: false },
  },
];

for (const testCase of cases) {
  test(`${testCase.name} lets a consumer class win`, () => {
    const mounted = mountTree(
      h(testCase.component, {
        ...testCase.props,
        class: testCase.win,
        'data-testid': 'root',
      }),
    );

    const className = byTestId(mounted.root, 'root').className;
    expect(className, `${testCase.name} dropped the consumer class`).toContain(
      testCase.win,
    );
    expect(
      className,
      `${testCase.name} kept its own class over the consumer's`,
    ).not.toContain(testCase.lose);

    mounted.app.unmount();
  });
}
