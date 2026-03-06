function isFinished(gameState) {
  if (!gameState) return false;
  const normalized = String(gameState).toUpperCase();
  return ['OFF', 'FINAL', 'COMPLETED', 'OVER'].includes(normalized);
}

function getNextCheckDelaySeconds(gameState) {
  const normalized = String(gameState || '').toUpperCase();
  if (normalized === 'CRIT') return 60;
  if (normalized === 'LIVE') return 120;
  if (normalized === 'FUT' || normalized === 'PRE') return 600;
  return 300;
}

function schedulerAtExpression(isoDateString) {
  return `at(${isoDateString.replace(/\.\d{3}Z$/, '')})`;
}

module.exports = {
  isFinished,
  getNextCheckDelaySeconds,
  schedulerAtExpression,
};
