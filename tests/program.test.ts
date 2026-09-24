import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProgram, LIGHT_DAYS, localDateKey, MAIN_DAYS, programSummary, reconcileProgram, recordProgramWorkout, RECOVERY_DAYS } from '../src/program.ts';

test('builds 30 days in a 3 main, 2 light and 2 recovery weekly rhythm', () => {
  const program=createProgram(1,'2026-09-01');
  assert.equal(program.days.length,30);
  assert.deepEqual(program.days.filter(day=>day.kind==='main').map(day=>day.index),[...MAIN_DAYS]);
  assert.deepEqual(program.days.filter(day=>day.kind==='light').map(day=>day.index),[...LIGHT_DAYS]);
  assert.deepEqual(program.days.filter(day=>day.kind==='recovery').map(day=>day.index),[...RECOVERY_DAYS]);
  assert.equal(program.days.filter(day=>day.kind==='main').length,13);
  assert.equal(program.days.filter(day=>day.kind==='light').length,9);
  assert.equal(program.days.filter(day=>day.kind==='recovery').length,8);
});

test('scales main goals and light sessions are half of the current goal',()=>{
 const p=createProgram(10,'2026-09-01');
 assert.deepEqual(p.days.filter(d=>d.kind==='main').map(d=>d.target),[10,10,11,11,12,12,13,13,12,13,13,14,14]);
 assert.equal(p.days[1].target,5);assert.equal(p.days[4].target,5);assert.equal(p.days[29].target,7);
 const p20=createProgram(20,'2026-09-01');assert.deepEqual(p20.days.filter(d=>d.kind==='main').map(d=>d.target),[20,20,22,22,24,24,26,26,24,26,26,28,28]);
});

test('two confident main workouts accelerate only the next main target',()=>{
 let p=createProgram(10,'2026-09-01');p=recordProgramWorkout(p,'2026-09-01',11);assert.equal(p.days[3].target,10);p=recordProgramWorkout(p,'2026-09-04',11);assert.equal(p.days[5].target,12);assert.equal(p.confidentStreak,0);
});

test('near miss repeats and a larger miss reduces the next main goal',()=>{
 let near=createProgram(10,'2026-09-01');near=recordProgramWorkout(near,'2026-09-01',8);assert.equal(near.days[3].target,10);
 let low=createProgram(10,'2026-09-01');low.days[0].target=12;low=recordProgramWorkout(low,'2026-09-01',7);assert.equal(low.days[3].target,11);
});

test('two failed main sessions turn the nearest light day into recovery',()=>{
 let p=createProgram(10,'2026-09-01');p=recordProgramWorkout(p,'2026-09-01',0);p=recordProgramWorkout(p,'2026-09-04',0);assert.equal(p.days[4].kind,'recovery');assert.equal(p.days[4].target,0);
});

test('a missed main is carried forward while missed light does not break streak',()=>{
 let p=createProgram(5,'2026-09-01');p.workoutStreak=2;p=reconcileProgram(p,'2026-09-04');assert.equal(p.days[0].status,'skipped');assert.equal(p.days[1].status,'skipped');assert.equal(p.workoutStreak,0);assert.equal(p.days[3].target,5);
});

test('summary reports control, best and main adherence',()=>{let p=createProgram(1,'2026-09-01');p=recordProgramWorkout(p,'2026-09-01',2);const s=programSummary(p);assert.equal(s.best,2);assert.equal(s.completed,1);assert.equal(s.total,13)});
test('day 20 is the planned deload main session',()=>{const w=createProgram(10,'2026-09-01').days.filter(d=>d.kind==='main');assert.equal(w[7].target,13);assert.equal(w[8].index,20);assert.equal(w[8].target,12)});
test('program completes after day 30 or after its light session',()=>{const p=createProgram(5,'2026-09-01');assert.equal(reconcileProgram(p,'2026-09-30').status,'active');assert.equal(reconcileProgram(p,'2026-10-01').status,'completed')});
test('local date key uses device calendar date',()=>assert.equal(localDateKey(new Date(2026,0,2,23,30)),'2026-01-02'));
