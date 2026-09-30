import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizePoseTrace } from '../src/coachEngineMetrics.ts';

test('pose trace summary preserves normalized measurements and coverage', () => {
  const trace = [
    { t: 0, confidence: .9, elbowAngle: 160, leftElbowAngle: 159, rightElbowAngle: 161, elbowAsymmetry: 2, handWidthRatio: 1.2, bodyLineDeviation: .02, shoulderToHandsRatio: 1, feetVisible: true },
    { t: .1, confidence: .9, elbowAngle: 130, leftElbowAngle: 128, rightElbowAngle: 132, elbowAsymmetry: 4, handWidthRatio: 1.2, bodyLineDeviation: .03, shoulderToHandsRatio: .8, feetVisible: true },
    { t: .2, confidence: .9, elbowAngle: 105, leftElbowAngle: 104, rightElbowAngle: 106, elbowAsymmetry: 2, handWidthRatio: 1.2, bodyLineDeviation: .025, shoulderToHandsRatio: .6, feetVisible: false },
  ];
  const summary = summarizePoseTrace(trace);
  assert.ok(summary);
  assert.equal(summary.detectedFrames, 3);
  assert.equal(summary.estimatedCompleteReps, 1);
  assert.equal(summary.footCoverage, 2 / 3);
  assert.equal(summary.metrics.handWidthRatio?.median, 1.2);
});
