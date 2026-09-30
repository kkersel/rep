import assert from 'node:assert/strict';
import test from 'node:test';
import type { WorkoutSession } from '../src/data';
import { techniqueStats } from '../src/techniqueStats';

const session = (id: string, score: number, code = 'elbows_flared'): WorkoutSession => ({
  id, date: `2026-09-${id.padStart(2, '0')}T12:00:00Z`, reps: 10, seconds: 30, goal: 10, mode: 'free',
  technique: { score, verdict: 'needs_adjustment', summary: 'Разбор', view: 'front', strengths: ['Ровный темп'], lessonIds: [], assessedAt: `2026-09-${id.padStart(2, '0')}T12:01:00Z`, errors: [{ code, observation: 'Локти расходятся', correction: 'Направляй назад', severity: 'mild' }] },
});

test('summarizes recent technique score and recurring issues', () => {
  const stats = techniqueStats([session('06', 9), session('05', 8.5), session('04', 8), session('03', 7), session('02', 7), session('01', 6)]);
  assert.equal(stats.score, 7.9);
  assert.equal(stats.trend, 1.8);
  assert.equal(stats.issues[0]?.count, 6);
  assert.equal(stats.issues[0]?.label, 'Траектория локтей');
});

test('ignores pvp and sessions without an assessment', () => {
  const free = session('01', 10);
  const pvp = { ...session('02', 2), mode: 'pvp' as const };
  const plain: WorkoutSession = { id: 'x', date: '2026-09-03T12:00:00Z', reps: 5, seconds: 20, goal: 0, mode: 'free' };
  const stats = techniqueStats([plain, pvp, free]);
  assert.equal(stats.assessed, 1);
  assert.equal(stats.score, 10);
});
