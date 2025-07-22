import { ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useThemeStore } from '@/store/themeStore';

export function useTheme() {
  const themeStore = useThemeStore();
  const { isDarkTheme } = storeToRefs(themeStore);
  const isDarkOrLight = ref(isDarkTheme.value ? 'dark' : 'light');

  watch(
    isDarkTheme,
    (newVal) => {
      isDarkOrLight.value = newVal ? 'dark' : 'light';
    },
    { immediate: true }
  );
  return {
    isDarkTheme,
    isDarkOrLight,
    toggleTheme: themeStore.toggleTheme,
  };
}
