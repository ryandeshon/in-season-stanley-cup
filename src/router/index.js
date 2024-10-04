import { createRouter, createWebHistory } from 'vue-router';
import HomePage from '../pages/HomePage.vue';
import StandingsPage from '../pages/StandingsPage.vue';

const routes = [
  { path: '/', component: HomePage },
  { path: '/standings', component: StandingsPage },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
