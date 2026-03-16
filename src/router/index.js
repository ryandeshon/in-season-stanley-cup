import { createRouter, createWebHistory } from 'vue-router';
import { getSeasonMeta } from '@/services/championServices';
import { getDraftPlayers, getDraftState } from '@/services/dynamodbService';
import { useSeasonStore } from '@/store/seasonStore';
import HomePage from '../pages/HomePage.vue';
import StandingsPage from '../pages/StandingsPage.vue';
import AboutPage from '../pages/AboutPage.vue';
import PlayerProfile from '../pages/PlayerProfile.vue';
import GamePage from '../pages/GamePage.vue';
import DraftPage from '../pages/DraftPage.vue';
import DraftAdminPage from '../pages/DraftAdminPage.vue';

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
    path: '/draft/:name?', // Make the :name parameter optional
    name: 'DraftPage',
    component: DraftPage,
    props: true,
  },
  {
    path: '/draft/admin',
    name: 'DraftAdminPage',
    component: DraftAdminPage,
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

async function resolveDraftRouteAccess(seasonId) {
  const seasonMeta = await getSeasonMeta({ season: seasonId });
  if (seasonMeta?.seasonOver) {
    return {
      allowDraftPage: true,
      allowDraftAdmin: true,
      readOnly: false,
    };
  }

  const [draftState, players] = await Promise.all([
    getDraftState({ season: seasonId }),
    getDraftPlayers({ season: seasonId }),
  ]);

  const noTeamsRemaining =
    Array.isArray(draftState?.availableTeams) &&
    draftState.availableTeams.length === 0;
  const everyPlayerHasTeams =
    Array.isArray(players) &&
    players.length > 0 &&
    players.every(
      (player) => Array.isArray(player?.teams) && player.teams.length > 0
    );

  const draftComplete = noTeamsRemaining && everyPlayerHasTeams;
  return {
    allowDraftPage: draftComplete,
    allowDraftAdmin: false,
    readOnly: draftComplete,
  };
}

router.beforeEach(async (to) => {
  if (!to.path.startsWith('/draft')) {
    return true;
  }

  const seasonStore = useSeasonStore();
  seasonStore.loadSeasonFromStorage();
  const seasonId = seasonStore.currentSeason || 'season2';

  try {
    const access = await resolveDraftRouteAccess(seasonId);

    if (to.path === '/draft/admin') {
      if (!access.allowDraftAdmin) {
        return { path: '/' };
      }
      return true;
    }

    if (!access.allowDraftPage) {
      return { path: '/' };
    }

    if (access.readOnly && to.query.mode !== 'readonly') {
      return {
        path: to.path,
        query: { ...to.query, mode: 'readonly' },
        replace: true,
      };
    }
    return true;
  } catch (error) {
    console.error('[router] Failed to validate draft route access:', error);
    return { path: '/' };
  }
});

export default router;
