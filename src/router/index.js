import { createRouter, createWebHistory } from 'vue-router';
import HomePage from '../pages/HomePage.vue';
import StandingsPage from '../pages/StandingsPage.vue';
import AboutPage from '../pages/AboutPage.vue';

const routes = [
  { path: '/', component: HomePage },
  { path: '/standings', component: StandingsPage },
  { path: '/about', component: AboutPage },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
