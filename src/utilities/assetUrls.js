const ASSET_BASE_URL = (process.env.VUE_APP_ASSET_BASE_URL || '').replace(
  /\/+$/,
  ''
);
const ASSET_VERSION = (process.env.VUE_APP_ASSET_VERSION || '')
  .trim()
  .replace(/^\/+|\/+$/g, '');

const PLAYER_NAME_MAP = {
  Boz: 'boz',
  Cooper: 'cooper',
  Ryan: 'ryan',
  Terry: 'terry',
};

const IMAGE_TYPE_MAP = {
  Happy: 'happy',
  Angry: 'angry',
  Sad: 'sad',
  Anguish: 'anguish',
  Winner: 'winner',
};

function buildAssetUrl(path) {
  if (!ASSET_BASE_URL) return null;

  const normalizedPath = path.replace(/^\/+/, '');
  const fullPath = ASSET_VERSION
    ? `${ASSET_VERSION}/${normalizedPath}`
    : normalizedPath;
  return `${ASSET_BASE_URL}/${fullPath}`;
}

export function getPlayerImageUrl(season, playerName, imageType) {
  if (!ASSET_BASE_URL) return null;

  const normalizedSeason = season === 'season1' ? 'season1' : 'season2';
  const normalizedPlayer =
    PLAYER_NAME_MAP[playerName] || playerName?.toLowerCase();
  if (!normalizedPlayer) return null;

  let normalizedType = IMAGE_TYPE_MAP[imageType] || imageType?.toLowerCase();
  if (!normalizedType) return null;

  // Season 1 does not have anguish variants; match current local fallback behavior.
  if (normalizedSeason === 'season1' && normalizedType === 'anguish') {
    normalizedType = 'sad';
  }

  return buildAssetUrl(
    `players/${normalizedSeason}/${normalizedPlayer}-${normalizedType}.webp`
  );
}

export function getTeamLogoUrl(season, teamAbbrev) {
  if (!ASSET_BASE_URL || season !== 'season2') return null;

  const normalizedTeam = teamAbbrev?.toUpperCase();
  if (!normalizedTeam) return null;

  return buildAssetUrl(`team-logos/season2/${normalizedTeam}.webp`);
}
