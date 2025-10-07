<template>
  <v-app>
    <!-- Navigation Bar -->
    <NavigationBar />

    <!-- Main Content -->
    <v-main>
      <router-view></router-view>
    </v-main>

    <!-- Footer -->
    <v-footer app color="primary">
      <span class="mx-auto"
        >© {{ new Date().getFullYear() }} In Season Cup</span
      >
    </v-footer>
  </v-app>
</template>

<script setup>
import { watch, computed } from 'vue';
import { useTheme } from '@/composables/useTheme';
import { useTheme as useVuetifyTheme } from 'vuetify';
import { useSeasonStore } from '@/store/seasonStore';
import NavigationBar from '@/components/NavigationBar.vue';

const { isDarkTheme } = useTheme();
const seasonStore = useSeasonStore();
const theme = useVuetifyTheme();

// Computed theme name based on season and dark/light mode
const currentThemeName = computed(() => {
  const season =
    seasonStore.currentSeason === 'season1' ? 'season1' : 'season2';
  const mode = isDarkTheme.value ? 'dark' : 'light';
  return `${season}-${mode}`;
});

// Watch for theme changes and update Vuetify theme
watch(
  currentThemeName,
  (newThemeName) => {
    theme.global.name.value = newThemeName;
  },
  { immediate: true }
);

// Also watch for dark theme changes to update immediately
watch(
  () => isDarkTheme.value,
  () => {
    theme.global.name.value = currentThemeName.value;
  }
);

// Watch for season changes to update theme
watch(
  () => seasonStore.currentSeason,
  () => {
    theme.global.name.value = currentThemeName.value;
  }
);
</script>

<style>
/* Import CSS files from the assets folder */
@import '@/assets/_variables.css';
@import '@/assets/style.css';
</style>
