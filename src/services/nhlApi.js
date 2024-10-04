import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'https://statsapi.web.nhl.com/api/v1/', // Use the base URL of the NHL API
  withCredentials: false,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

export default {
  getTeams() {
    return apiClient.get('/teams');
  },
  getSchedule() {
    return apiClient.get('/schedule');
  },
  getStandings() {
    return apiClient.get('/standings');
  },
};
