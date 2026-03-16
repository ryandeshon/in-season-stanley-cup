import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import vuetify from './plugins/vuetify';
import { useThemeStore } from '@/store/themeStore';
import { useSeasonStore } from '@/store/seasonStore';

// Import Tailwind CSS
import './assets/tailwind.css';
// Import global styles
import '@/assets/_variables.css';
import '@/assets/style.css';

const app = createApp(App);
const pinia = createPinia();
app.use(router);
app.use(vuetify);
app.use(pinia);

// Detect system theme
const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');
const themeStore = useThemeStore(pinia);
const seasonStore = useSeasonStore(pinia);

async function bootstrap() {
  await seasonStore.initializeSeasonOptions();

  if (prefersDarkScheme.matches) {
    themeStore.isDarkTheme = true;
  } else {
    themeStore.isDarkTheme = false;
  }

  prefersDarkScheme.addEventListener('change', (event) => {
    themeStore.isDarkTheme = event.matches;
  });

  app.mount('#app');
}

bootstrap();
