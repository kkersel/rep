import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProgram, localDateKey, programSummary, reconcileProgram, recordProgramWorkout, TRAINING_DAYS } from '../src/program.ts';

test('builds the exact 30-day schedule for baseline 1', () => {
  const program = createProgram(1, '2026-09-01');
  assert.equal(program.days.length, 30);
  assert.deepEqual(program.days.filter(day => day.kind === 'training').map(day => day.index), [...TRAINING_DAYS]);
  assert.deepEqual(program.days.filter(day => day.kind === 'training').map(day => day.target), [1, 1, 2, 2, 3, 3, 4, 4, 3, 4, 4, 5, 5]);
  assert.equal(program.days[29].kind, 'summary');
});

test('scales the step from the comfortable baseline', () => {
  assert.deepEqual(createProgram(10, '2026-09-01').days.filter(d => d.kind === 'training').map(d => d.target), [10,10,11,11,12,12,13,13,12,13,13,14,14]);
  assert.deepEqual(createProgram(20, '2026-09-01').days.filter(d => d.kind === 'training').map(d => d.target), [20,20,22,22,24,24,26,26,24,26,26,28,28]);
});

test('two confident workouts accelerate only the next target by one step', () => {
  let program = createProgram(10, '2026-09-01');
  program = recordProgramWorkout(program, '2026-09-01', 11);
  assert.equal(program.days[2].target, 10);
  program = recordProgramWorkout(program, '2026-09-03', 11);
  assert.equal(program.days[4].target, 12);
  assert.equal(program.confidentStreak, 0);
});

test('near miss repeats and a larger miss reduces the next goal', () => {
  let near = createProgram(10, '2026-09-01');
  near = recordProgramWorkout(near, '2026-09-01', 8);
  assert.equal(near.days[2].target, 10);
  let low = createProgram(10, '2026-09-01');
  low.days[0].target = 12;
  low = recordProgramWorkout(low, '2026-09-01', 7);
  assert.equal(low.days[2].target, 11);
});

test('missed workout is marked skipped and carried forward without moving dates', () => {
  const program = reconcileProgram(createProgram(5, '2026-09-01'), '2026-09-04');
  assert.equal(program.days[0].status, 'skipped');
  assert.equal(program.days[2].status, 'skipped');
  assert.equal(program.days[4].target, 5);
  assert.equal(program.days[4].date, '2026-09-05');
});

test('summary reports control, best result and adherence', () => {
  let program = createProgram(1, '2026-09-01');
  program = recordProgramWorkout(program, '2026-09-01', 2);
  const summary = programSummary(program);
  assert.equal(summary.best, 2);
  assert.equal(summary.completed, 1);
  assert.equal(summary.total, 13);
});

test('day 19 is the planned deload workout', () => {
  const workouts = createProgram(10, '2026-09-01').days.filter(day => day.kind === 'training');
  assert.equal(workouts[7].target, 13);
  assert.equal(workouts[8].index, 19);
  assert.equal(workouts[8].target, 12);
});

test('program completes on calendar day 30', () => {
  const program = createProgram(5, '2026-09-01');
  assert.equal(reconcileProgram(program, '2026-09-29').status, 'active');
  assert.equal(reconcileProgram(program, '2026-09-30').status, 'completed');
});

test('local date key uses the device calendar date', () => {
  assert.equal(localDateKey(new Date(2026, 0, 2, 23, 30)), '2026-01-02');
});
