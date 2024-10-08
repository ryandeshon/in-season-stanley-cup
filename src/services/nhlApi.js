// Docs: https://gitlab.com/dword4/nhlapi/-/blob/master/new-api.md

import axios from 'axios';
import { DateTime } from 'luxon';

const apiClient = axios.create({
  baseURL: process.env.VUE_APP_NHL_API_URL,
  withCredentials: false,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});
  console.log("🚀 ~ process.env.VUE_APP_NHL_API_URL:", process.env.VUE_APP_NHL_API_URL)

export default {
  getSchedule() {
    const getToday = DateTime.now().toFormat('yyyy-MM-dd');
    return apiClient.get(`/schedule/${getToday}`);
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
  getResult(gameId) {
    return apiClient.get(`/gamecenter/${gameId}/boxscore`);
  },
};
