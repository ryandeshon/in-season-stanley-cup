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
import { watch } from 'vue';
import { useTheme } from '@/composables/useTheme';
import { useTheme as useVuetifyTheme } from 'vuetify';
import NavigationBar from '@/components/NavigationBar.vue';

const { isDarkTheme } = useTheme();
const theme = useVuetifyTheme();

watch(
  () => isDarkTheme.value,
  (newVal) => {
    theme.global.name.value = newVal ? 'dark' : 'light';
  },
  { immediate: true }
);
</script>

<style>
/* Import CSS files from the assets folder */
@import '@/assets/_variables.css';
@import '@/assets/style.css';
</style>
