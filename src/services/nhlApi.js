// Docs: https://gitlab.com/dword4/nhlapi/-/blob/master/new-api.md

import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'https://api-web.nhle.com/v1', // Use the base URL of the NHL API
  withCredentials: false,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

export default {
  getSchedule() {
    return apiClient.get('/schedule/now');
  },
  getStandings() {
    return apiClient.get('/standings/now');
  },
  getScores() {
    return apiClient.get('/score/now');
  }
};
