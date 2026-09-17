function createNhl({ NHL_API_BASE, https, log }) {
  function getDateInTimeZone(offsetDays = 0, tz = 'America/New_York') {
    const date = new Date();
    if (offsetDays) {
      date.setUTCDate(date.getUTCDate() + offsetDays);
    }
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  }

  async function fetchSchedule(date) {
    const apiUrl = `${NHL_API_BASE}/schedule/${date}`;
    return new Promise((resolve, reject) => {
      const req = https.get(apiUrl, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            log('error', 'JSON parse error from NHL schedule API', {
              error: String(e),
              snippet: data?.slice?.(0, 240),
            });
            reject(e);
          }
        });
      });

      req.on('error', (e) => {
        log('error', 'API request error', { error: String(e), url: apiUrl });
        reject(e);
      });

      req.setTimeout(8000, () => {
        log('error', 'API request timed out', { url: apiUrl });
        req.destroy(new Error('Request timeout'));
      });
    });
  }

  function findChampionGame(schedule, champion, date) {
    const gameWeek = schedule?.gameWeek;
    if (!Array.isArray(gameWeek)) return null;
    const today = gameWeek.find((d) => d?.date === date);
    const games = today?.games || [];
    for (const g of games) {
      const home = g?.homeTeam?.abbrev;
      const away = g?.awayTeam?.abbrev;
      if (home === champion || away === champion) return g.id;
    }
    return null;
  }

  async function resolveGameIdFromSchedule(champion) {
    const datesToTry = [getDateInTimeZone(0), getDateInTimeZone(-1)];
    for (const date of datesToTry) {
      const schedule = await fetchSchedule(date);
      const found = findChampionGame(schedule, champion, date);
      if (found) return { gameID: found, date };
    }
    return null;
  }

  async function fetchGameData(gameID) {
    const apiUrl = `${NHL_API_BASE}/gamecenter/${gameID}/boxscore`;

    return new Promise((resolve, reject) => {
      const req = https.get(apiUrl, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const gameData = JSON.parse(data);

            const homeTeam = gameData.homeTeam;
            const awayTeam = gameData.awayTeam;
            const gameState = gameData.gameState;
            const gameType = gameData.gameType;

            resolve({
              gameState,
              gameType,
              homeAbbrev: homeTeam?.abbrev,
              awayAbbrev: awayTeam?.abbrev,
              homeScore: homeTeam?.score,
              awayScore: awayTeam?.score,
            });
          } catch (e) {
            log('error', 'JSON parse error from NHL API', {
              error: String(e),
              snippet: data?.slice?.(0, 240),
            });
            reject(e);
          }
        });
      });

      req.on('error', (e) => {
        log('error', 'API request error', { error: String(e), url: apiUrl });
        reject(e);
      });

      req.setTimeout(8000, () => {
        log('error', 'API request timed out', { url: apiUrl });
        req.destroy(new Error('Request timeout'));
      });
    });
  }
  return {
    getDateInTimeZone,
    fetchSchedule,
    findChampionGame,
    resolveGameIdFromSchedule,
    fetchGameData,
  };
}
module.exports = { createNhl };
