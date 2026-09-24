import { test } from 'node:test';
import assert from 'node:assert/strict';
import { completeStreak, normalizePlan, targetForToday, type StreakPlan } from '../src/streak.ts';

const plan = (): StreakPlan => ({ minimum: 10, increase: 2, streak: 0, bestStreak: 0, lastCompletedDate: null });

test('starts with the chosen minimum and adds two after each completed day', () => {
  const dayOne = completeStreak(plan(), 10, '2026-09-22');
  assert.equal(dayOne.streak, 1);
  assert.equal(targetForToday(dayOne, '2026-09-23'), 12);
  const dayTwo = completeStreak(dayOne, 12, '2026-09-23');
  assert.equal(targetForToday(dayTwo, '2026-09-24'), 14);
});

test('does not award the same day twice', () => {
  const once = completeStreak(plan(), 10, '2026-09-22');
  assert.deepEqual(completeStreak(once, 99, '2026-09-22'), once);
  assert.equal(targetForToday(once, '2026-09-22'), 10);
});

test('a failed attempt leaves the streak unchanged', () => {
  assert.deepEqual(completeStreak(plan(), 9, '2026-09-22'), plan());
});

test('missing a full day resets the current streak but preserves the record', () => {
  const old = { ...plan(), streak: 4, bestStreak: 7, lastCompletedDate: '2026-09-20' };
  assert.deepEqual(normalizePlan(old, '2026-09-22'), { ...old, streak: 0, lastCompletedDate: null });
});
