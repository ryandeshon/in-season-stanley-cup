import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

// Each resource has its own generation: partial refreshes cannot revive stale data.
export function useSeasonResources(
  context,
  loaders,
  initialValues,
  { enabled = () => true } = {}
) {
  const keys = Object.keys(loaders);
  const values = Object.fromEntries(
    keys.map((key) => [key, ref(initialValues[key]())])
  );
  const pending = ref({});
  const errors = ref({});
  const generations = Object.fromEntries(keys.map((key) => [key, 0]));
  let mounted = false;
  let disposed = false;

  async function refresh(selected = keys) {
    if (disposed || !enabled()) return;
    const scope = context();
    await Promise.all(
      selected.map(async (key) => {
        const generation = ++generations[key];
        pending.value[key] = true;
        errors.value[key] = null;
        try {
          const value = await loaders[key](scope);
          if (!disposed && generation === generations[key])
            values[key].value = value ?? initialValues[key]();
        } catch (error) {
          if (!disposed && generation === generations[key])
            errors.value[key] = error;
        } finally {
          if (!disposed && generation === generations[key])
            pending.value[key] = false;
        }
      })
    );
  }

  watch(
    context,
    () => {
      for (const key of keys) {
        generations[key]++;
        values[key].value = initialValues[key]();
      }
      pending.value = {};
      errors.value = {};
      if (mounted) refresh();
    },
    { flush: 'sync' }
  );
  onMounted(() => {
    mounted = true;
    refresh();
  });
  onBeforeUnmount(() => {
    disposed = true;
  });

  return {
    ...values,
    loading: computed(() => Object.values(pending.value).some(Boolean)),
    error: computed(() => Object.values(errors.value).find(Boolean) || null),
    refresh,
  };
}
