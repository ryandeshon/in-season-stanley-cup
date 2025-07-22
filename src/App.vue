<template>
  <v-app>
    <!-- App Bar / Navigation Bar -->
    <v-app-bar app color="primary" class="px-2">
      <router-link to="/" class="mr-2 h-10">
        <img :src="logo" alt="In Season Cup Logo" class="h-10" />
      </router-link>
      <v-spacer></v-spacer>
      <div class="flex justify-center items-center gap-1">
        <v-btn text to="/draft">Draft</v-btn>
        <v-btn text to="/standings">Standings</v-btn>
        <v-btn text to="/about">About</v-btn>
        <v-spacer></v-spacer>
        <v-btn
          :icon="isDarkTheme ? 'mdi-lightbulb-outline' : 'mdi-lightbulb'"
          size="small"
          text
          @click="toggleTheme"
        />
      </div>
    </v-app-bar>

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
import { useTheme } from '@/composables/useTheme';
import { watch } from 'vue';
import { useTheme as useVuetifyTheme } from 'vuetify';
import logo from '@/assets/in-season-logo.png';

const { isDarkTheme, toggleTheme } = useTheme();

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
