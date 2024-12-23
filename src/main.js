import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import vuetify from './plugins/vuetify';
// Import Tailwind CSS
import './assets/tailwind.css';
// Import global styles
import '@/assets/_variables.css';
import '@/assets/style.css';

createApp(App).use(router).use(vuetify).mount('#app');

// Detect system theme
const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');

if (prefersDarkScheme.matches) {
  vuetify.theme.global.name.value = 'dark';
} else {
  vuetify.theme.global.name.value = 'light';
}

// Listen for changes in theme preference
prefersDarkScheme.addEventListener('change', (event) => {
  vuetify.theme.global.name.value = event.matches ? 'dark' : 'light';
});
