import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { Amplify } from 'aws-amplify';
import awsconfig from './aws-exports';

// Initialize Amplify first, before any other imports
Amplify.configure(awsconfig);

import App from './App.vue';
import router from './router';
import vuetify from './plugins/vuetify';
import { useThemeStore } from '@/store/themeStore'; // Import the theme store
import { useSeasonStore } from '@/store/seasonStore'; // Import the season store

// Import Tailwind CSS
import './assets/tailwind.css';
// Import global styles
import '@/assets/_variables.css';
import '@/assets/style.css';

const app = createApp(App);
app.use(router);
app.use(vuetify);
app.use(createPinia());
app.mount('#app');

// Detect system theme
const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');
// Access the theme store
const themeStore = useThemeStore();
// Access the season store and load from localStorage
const seasonStore = useSeasonStore();
seasonStore.loadSeasonFromStorage();

if (prefersDarkScheme.matches) {
  themeStore.isDarkTheme = true; // Update the store state
} else {
  themeStore.isDarkTheme = false; // Update the store state
}

// Listen for changes in theme preference
prefersDarkScheme.addEventListener('change', (event) => {
  themeStore.isDarkTheme = event.matches; // Update the store state
});
