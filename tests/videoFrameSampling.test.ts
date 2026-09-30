import assert from 'node:assert/strict';
import test from 'node:test';
import { COACH_FRAME_COUNT, sampleFramePlan } from '../src/videoFrameSampling';

test('creates labelled chronological coach frames away from black endpoints', () => {
  const plan = sampleFramePlan(13);
  assert.equal(plan.length, COACH_FRAME_COUNT);
  assert.equal(plan[0]?.index, 1);
  assert.equal(plan.at(-1)?.index, COACH_FRAME_COUNT);
  assert.ok((plan[0]?.timeSeconds ?? 0) > 0);
  assert.ok((plan.at(-1)?.timeSeconds ?? 13) < 13);
  assert.ok(plan.every((frame, index) => index === 0 || frame.timeSeconds > plan[index - 1]!.timeSeconds));
});

test('normalizes invalid duration and excessive requested count', () => {
  const plan = sampleFramePlan(Number.NaN, 99);
  assert.equal(plan.length, 12);
  assert.ok(plan.every(frame => Number.isFinite(frame.timeSeconds)));
});
