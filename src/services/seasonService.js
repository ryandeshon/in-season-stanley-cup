import { apiRequest } from '@/services/apiClient';

function normalizeSeasonId(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  if (!normalized) return null;
  if (/^season\d+$/.test(normalized)) {
    return normalized;
  }
  const parsed = Number(normalized);
  if (Number.isInteger(parsed) && parsed > 0) {
    return `season${parsed}`;
  }
  return null;
}

function toSeasonLabel(seasonId) {
  const match = String(seasonId || '').match(/^season(\d+)$/);
  if (!match) return String(seasonId || '');
  return String(Number(match[1]));
}

function normalizeSeasonOption(entry) {
  if (typeof entry === 'string') {
    const id = normalizeSeasonId(entry);
    if (!id) return null;
    return { id, label: toSeasonLabel(id) };
  }
  if (!entry || typeof entry !== 'object') return null;
  const id = normalizeSeasonId(entry.id || entry.value);
  if (!id) return null;
  return {
    id,
    label: String(entry.label || toSeasonLabel(id)),
    status: entry.status || null,
  };
}

function normalizeSeasonOptionsPayload(payload = {}) {
  const defaultSeason = normalizeSeasonId(payload.defaultSeason) || 'season2';
  const options = Array.isArray(payload.seasons)
    ? payload.seasons.map(normalizeSeasonOption).filter(Boolean)
    : [];

  const unique = [];
  const seen = new Set();
  options.forEach((entry) => {
    if (seen.has(entry.id)) return;
    seen.add(entry.id);
    unique.push(entry);
  });

  if (!seen.has(defaultSeason)) {
    unique.push({
      id: defaultSeason,
      label: toSeasonLabel(defaultSeason),
      status: null,
    });
  }

  unique.sort((a, b) => {
    const aNum = Number((a.id.match(/^season(\d+)$/) || [])[1] || 9999);
    const bNum = Number((b.id.match(/^season(\d+)$/) || [])[1] || 9999);
    return aNum - bNum;
  });

  return {
    defaultSeason,
    seasons: unique,
    updatedAt: payload.updatedAt || null,
  };
}

export async function getSeasonOptions() {
  const payload = await apiRequest('/season/options', {
    retries: 0,
  });
  return normalizeSeasonOptionsPayload(payload);
}

export function getFallbackSeasonOptions() {
  return normalizeSeasonOptionsPayload({
    defaultSeason: 'season2',
    seasons: ['season1', 'season2'],
  });
}
