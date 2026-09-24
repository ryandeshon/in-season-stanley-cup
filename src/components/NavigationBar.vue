<template>
  <v-app-bar app color="primary" class="px-2">
    <router-link
      v-if="arcade"
      to="/"
      class="arcade-brand"
      aria-label="In Season Cup home"
      ><img class="brand-mark" :src="arcadeCup" alt="" />
      <span
        ><img
          class="arcade-wordmark"
          :src="arcadeLogo"
          alt="In Season Cup"
        /><small>SEASON 03</small></span
      ></router-link
    >
    <router-link v-else to="/" class="mr-2 h-10">
      <img :src="currentLogo" alt="In Season Cup Logo" class="h-10" />
    </router-link>
    <v-spacer></v-spacer>
    <!-- Mobile Menu Button -->
    <v-menu
      :transition="false"
      v-model="menuOpen"
      location="bottom end"
      :close-on-content-click="false"
    >
      <template v-slot:activator="{ props }">
        <v-btn
          data-test="navigation-menu"
          aria-label="Open navigation"
          icon="mdi-menu"
          size="small"
          v-bind="props"
        />
      </template>

      <v-list class="py-0" min-width="200">
        <!-- Navigation Items -->
        <v-list-item to="/" prepend-icon="mdi-home" title="Arena" />
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

        <v-list-item to="/draft" title="Draft" />
        <v-list-item to="/story" title="Story" />
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
              data-test="season-select"
              aria-label="Season"
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
import { ref, onMounted, watch, computed } from 'vue';
import { useRoute } from 'vue-router';
import { useTheme } from '@/composables/useTheme';
import { useSeasonStore } from '@/store/seasonStore';
import arcadeCup from '@/assets/arcade/icons/championship-cup.svg';
import arcadeLogo from '@/assets/arcade/icons/in-season-cup-logo.svg';
import season1Logo from '@/assets/in-season-logo-season1.png';
import season2Logo from '@/assets/in-season-logo-season2.png';

const { isDarkTheme, toggleTheme } = useTheme();
const seasonStore = useSeasonStore();
const menuOpen = ref(false);
const route = useRoute();
watch(
  () => route.fullPath,
  () => {
    menuOpen.value = false;
  }
);
const selectedSeason = ref(seasonStore.currentSeason);
const arcade = computed(() => seasonStore.currentSeason === 'season3');

// Computed property for current logo based on season
const currentLogo = computed(() => {
  return seasonStore.currentSeason === 'season1' ? season1Logo : season2Logo;
});

const seasonOptions = computed(() =>
  seasonStore.seasons.map((s) => ({ label: s.id.slice(6), value: s.id }))
);

const handleSeasonChange = (newSeason) => {
  seasonStore.setSeason(newSeason);
  updateFontForSeason(newSeason);
};

// Function to update CSS variables for fonts
const updateFontForSeason = (season) => {
  const root = document.documentElement;
  if (season === 'season3') {
    root.style.setProperty('--font-heading', "'Press Start 2P', monospace");
  } else if (season === 'season1') {
    root.style.setProperty('--font-heading', "'Roboto Condensed', sans-serif");
  } else {
    root.style.setProperty(
      '--font-heading',
      "'Homer Simpson Revised', sans-serif"
    );
  }
};

// Watch for changes in the store and update local state
watch(
  () => seasonStore.currentSeason,
  (newSeason) => {
    selectedSeason.value = newSeason;
    updateFontForSeason(newSeason);
  }
);

onMounted(() => {
  // Load season from localStorage on mount
  seasonStore.loadSeasonFromStorage();
  selectedSeason.value = seasonStore.currentSeason;
  // Set initial font based on current season
  updateFontForSeason(seasonStore.currentSeason);
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
