// Docs: https://gitlab.com/dword4/nhlapi/-/blob/master/new-api.md

import axios from 'axios';
import { DateTime } from 'luxon';

const apiClient = axios.create({
  baseURL: process.env.VUE_APP_NHL_API_URL, // Use the proxy defined in vue.config.js
  withCredentials: false,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

export default {
  getSchedule(date = DateTime.now().toFormat('yyyy-MM-dd')) {
    return apiClient.get(`/schedule/${date}`);
  },
  getStandings() {
    return apiClient.get('/standings/now');
  },
  getScores() {
    return apiClient.get('/score/now');
  },
  getTeams() {
    return apiClient.get('/team');
  },
  getTeam(teamId) {
    return apiClient.get(`/team/${teamId}`);
  },
  getTeamId(teamName) {
    return apiClient.get(`/team/${teamName}`);
  },
  getGameInfo(gameId) {
    return apiClient.get(`/gamecenter/${gameId}/boxscore`);
  },
};
