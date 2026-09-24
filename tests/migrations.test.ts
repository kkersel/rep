import { test } from 'node:test';
import assert from 'node:assert/strict';
import { legacyBaselineFromValue, migrateSessionValue } from '../src/migrations.ts';

test('legacy plan keeps its comfortable starting value', () => {
  assert.equal(legacyBaselineFromValue({ minimum: 10 }), 10);
  assert.equal(legacyBaselineFromValue({ minimum: 0 }), 1);
  assert.equal(legacyBaselineFromValue({ minimum: 150 }), 100);
});

test('legacy history migrates without losing repetitions or duration', () => {
  const source = [
    { id: 'a', date: '2026-09-01T10:00:00.000Z', reps: 8, seconds: 42, goal: 8, mode: 'streak' },
    { id: 'b', date: '2026-09-02T10:00:00.000Z', reps: 12, seconds: 55, goal: 12, mode: 'challenge' },
  ];
  const result = source.map(migrateSessionValue);
  assert.deepEqual(result.map(item => item?.mode), ['program', 'free']);
  assert.equal(result.reduce((sum, item) => sum + (item?.reps ?? 0), 0), 20);
  assert.equal(result.reduce((sum, item) => sum + (item?.seconds ?? 0), 0), 97);
});

test('current sessions keep sync and program metadata', () => {
  const result = migrateSessionValue({ id: 'p', date: '2026-09-24T10:00:00.000Z', reps: 46, seconds: 60, goal: 0, mode: 'pvp', pvpResult: 'win', programDay: 4, synced: true });
  assert.equal(result?.pvpResult, 'win');
  assert.equal(result?.programDay, 4);
  assert.equal(result?.synced, true);
});
