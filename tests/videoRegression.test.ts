import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { RepCounter } from '../src/counter';
import { observePoseSource } from '../src/poseObservation';

const observePose = new Function(`return (${observePoseSource})`)() as (
  points: Array<{ x: number; y: number; z?: number; visibility: number }>,
  aspectRatio: number,
) => import('../src/counter').Observation | null;

const cases = [
  ['pushup-front', 3],
  ['pushup-front-2', 2],
  ['pushup-front-3', 2],
  ['pushup-front-4', 29],
  ['pushup-front-5', 6],
  ['pushup-front-plyometric', 9],
  ['pushup-knees-user-20260930', 0],
] as const;

for (const [name, expected] of cases) {
  test(`pose regression: ${name} counts ${expected}`, () => {
    const frames = JSON.parse(readFileSync(`reference-data/regression/${name}.trace.json`, 'utf8')) as Array<{
      timeSeconds: number;
      aspectRatio: number;
      landmarks: Parameters<typeof observePose>[0];
    }>;
    const counter = new RepCounter();
    for (const frame of frames) {
      counter.update(observePose(frame.landmarks, frame.aspectRatio), frame.timeSeconds * 1000);
    }
    assert.equal(counter.count, expected);
  });
}
