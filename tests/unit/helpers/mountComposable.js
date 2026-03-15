import { createApp, h, nextTick } from 'vue';

export async function mountComposable(useComposable) {
  let result;
  const root = document.createElement('div');
  document.body.appendChild(root);

  const app = createApp({
    setup() {
      result = useComposable();
      return () => h('div');
    },
  });

  app.mount(root);
  await nextTick();

  return {
    result,
    async unmount() {
      app.unmount();
      await nextTick();
      root.remove();
    },
  };
}
