import { createRouter, createWebHistory } from 'vue-router';
import HomePage from '../pages/HomePage.vue';
import StandingsPage from '../pages/StandingsPage.vue';
import AboutPage from '../pages/AboutPage.vue';
import PlayerProfile from '../pages/PlayerProfile.vue';
import GamePage from '../pages/GamePage.vue';
import DraftPage from '../pages/DraftPage.vue';

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
  {
    path: '/game/:id', // Add a new route for game details
    name: 'GamePage',
    component: GamePage,
    props: true,
  },
  {
    path: '/draft/:name', // Add a new route for game details
    name: 'DraftPage',
    component: DraftPage,
    props: true,
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
