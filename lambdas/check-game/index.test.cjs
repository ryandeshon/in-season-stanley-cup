const test = require('node:test');
const assert = require('node:assert/strict');

const __test = require('./check-game-logic.cjs');

test('isFinished recognizes final states', () => {
  assert.equal(__test.isFinished('FINAL'), true);
  assert.equal(__test.isFinished('OFF'), true);
  assert.equal(__test.isFinished('LIVE'), false);
});

test('getNextCheckDelaySeconds adapts by game state', () => {
  assert.equal(__test.getNextCheckDelaySeconds('FUT'), 600);
  assert.equal(__test.getNextCheckDelaySeconds('LIVE'), 120);
  assert.equal(__test.getNextCheckDelaySeconds('CRIT'), 60);
  assert.equal(__test.getNextCheckDelaySeconds('UNKNOWN'), 300);
});

test('schedulerAtExpression formats one-time EventBridge schedule expression', () => {
  assert.equal(
    __test.schedulerAtExpression('2026-03-06T05:45:21.123Z'),
    'at(2026-03-06T05:45:21)'
  );
});
