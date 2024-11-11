import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import vuetify from './plugins/vuetify';
import './assets/tailwind.css'; // Import Tailwind CSS

createApp(App).use(router).use(vuetify).mount('#app');
