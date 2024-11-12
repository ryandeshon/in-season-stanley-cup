import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import vuetify from './plugins/vuetify';
 // Import Tailwind CSS
import './assets/tailwind.css';
// Import global styles
import '@/assets/_variables.css';
import '@/assets/style.css';

createApp(App).use(router).use(vuetify).mount('#app');
