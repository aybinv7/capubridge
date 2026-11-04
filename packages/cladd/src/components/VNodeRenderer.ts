import { defineComponent, type PropType, type VNodeChild } from 'vue';

export default defineComponent({
  name: 'VNodeRenderer',
  props: {
    node: {
      type: null as unknown as PropType<VNodeChild | undefined>,
      default: undefined,
    },
  },
  setup(props) {
    return () => props.node ?? null;
  },
});
