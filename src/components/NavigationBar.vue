<template>
  <v-app-bar app color="primary" class="px-2">
    <router-link to="/" class="mr-2 h-10">
      <img :src="logo" alt="In Season Cup Logo" class="h-10" />
    </router-link>
    <v-spacer></v-spacer>

    <!-- Mobile Menu Button -->
    <v-menu location="bottom end" :close-on-content-click="false">
      <template v-slot:activator="{ props }">
        <v-btn icon="mdi-menu" size="small" v-bind="props" />
      </template>

      <v-list class="py-0" min-width="200">
        <!-- Navigation Items -->
        <v-list-item
          to="/standings"
          prepend-icon="mdi-trophy"
          title="Standings"
          class="no-underline"
        />
        <v-list-item
          to="/about"
          prepend-icon="mdi-information"
          title="About"
          class="no-underline"
        />

        <v-divider />

        <!-- Settings Section -->
        <v-list-subheader>Settings</v-list-subheader>

        <!-- Theme Toggle -->
        <v-list-item
          @click.stop="toggleTheme"
          :prepend-icon="
            isDarkTheme ? 'mdi-lightbulb-outline' : 'mdi-lightbulb'
          "
        >
          <v-list-item-title>
            {{ isDarkTheme ? 'Light Mode' : 'Dark Mode' }}
          </v-list-item-title>
        </v-list-item>

        <!-- Season Selector -->
        <v-list-item
          @click.stop
          :ripple="false"
          :disabled="false"
          class="no-hover"
        >
          <v-list-item-title>Season</v-list-item-title>
          <template v-slot:append>
            <v-select
              v-model="selectedSeason"
              :items="seasonOptions"
              item-title="label"
              item-value="value"
              density="compact"
              variant="outlined"
              style="min-width: 100px; max-width: 100px"
              hide-details
              @update:model-value="handleSeasonChange"
              @click.stop
            />
          </template>
        </v-list-item>
      </v-list>
    </v-menu>
  </v-app-bar>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { useTheme } from '@/composables/useTheme';
import { useSeasonStore } from '@/store/seasonStore';
import logo from '@/assets/in-season-logo.png';

const { isDarkTheme, toggleTheme } = useTheme();
const seasonStore = useSeasonStore();
const selectedSeason = ref(seasonStore.currentSeason);

const seasonOptions = [
  { label: 'v1', value: 'season1' },
  { label: 'v2', value: 'season2' },
];

const handleSeasonChange = (newSeason) => {
  seasonStore.setSeason(newSeason);
};

// Watch for changes in the store and update local state
watch(
  () => seasonStore.currentSeason,
  (newSeason) => {
    selectedSeason.value = newSeason;
  }
);

onMounted(() => {
  // Load season from localStorage on mount
  seasonStore.loadSeasonFromStorage();
  selectedSeason.value = seasonStore.currentSeason;
});
</script>

<style scoped>
.no-underline :deep(a) {
  text-decoration: none !important;
}

.no-underline :deep(a:hover) {
  text-decoration: none !important;
}

.no-hover {
  pointer-events: none !important;
}

.no-hover :deep(.v-select) {
  pointer-events: auto !important;
}
</style>
