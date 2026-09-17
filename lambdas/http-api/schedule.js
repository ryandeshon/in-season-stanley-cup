export function createSchedule({ NHL_API_BASE, https }) {
  function getToday(tz = 'America/New_York') {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  }

  async function fetchSchedule(date) {
    const url = `${NHL_API_BASE}/schedule/${date}`;
    return new Promise((resolve, reject) => {
      const req = https.get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (err) {
            reject(err);
          }
        });
      });
      req.on('error', reject);
      req.setTimeout(8000, () => {
        req.destroy(new Error('Request timed out'));
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
  return { getToday, fetchSchedule, findChampionGame };
}
