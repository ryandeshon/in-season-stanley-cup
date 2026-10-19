import { createRouter, createWebHistory } from 'vue-router';
import HomePage from '../pages/HomePage.vue';

const routes = [
  { path: '/', component: HomePage },
  { path: '/story', component: () => import('../pages/StoryPage.vue') },
  { path: '/standings', component: () => import('../pages/StandingsPage.vue') },
  { path: '/about', component: () => import('../pages/AboutPage.vue') },
  {
    path: '/player/:name', // Dynamic route using player's name
    name: 'PlayerProfile',
    component: () => import('../pages/PlayerProfile.vue'),
    props: true, // Pass the name parameter as a prop
  },
  {
    path: '/game/:id', // Add a new route for game details
    name: 'GamePage',
    component: () => import('../pages/GamePage.vue'),
    props: true,
  },
  {
    path: '/draft/:name?', // Make the :name parameter optional
    name: 'DraftPage',
    component: () => import('../pages/DraftPage.vue'),
    props: true,
  },
  {
    path: '/draft/admin',
    name: 'DraftAdminPage',
    component: () => import('../pages/DraftAdminPage.vue'),
  },
  {
    path: '/champion-test',
    name: 'ChampionTest',
    component: () => import('../pages/ChampionTest.vue'),
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (to.path === '/story' || from.path === '/story')
      return savedPosition || { top: 0 };
  },
});

export default router;
