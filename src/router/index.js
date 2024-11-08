import { createRouter, createWebHistory } from 'vue-router';
import HomePage from '../pages/HomePage.vue';
import StandingsPage from '../pages/StandingsPage.vue';
import AboutPage from '../pages/AboutPage.vue';
import PlayerProfile from '../pages/PlayerProfile.vue';

const routes = [
  { path: '/', component: HomePage },
  { path: '/standings', component: StandingsPage },
  { path: '/about', component: AboutPage },
  {
    path: '/player/:name', // Dynamic route using player's name
    name: 'PlayerProfile',
    component: PlayerProfile,
    props: true, // Pass the name parameter as a prop
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
