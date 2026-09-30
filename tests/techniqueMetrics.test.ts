import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildReferenceProfile,
  countCompleteReps,
  measureTechniqueFrame,
  profileForPrompt,
  type PosePoint,
  type TechniqueFrameMetrics,
} from '../src/techniqueMetrics.ts';

const point = (x: number, y: number, visibility = 0.99): PosePoint => ({ x, y, visibility });

function pose(elbowY = 0.55) {
  const points = Array.from({ length: 33 }, () => point(0.5, 0.5, 0));
  points[11] = point(0.42, 0.35);
  points[12] = point(0.58, 0.35);
  points[13] = point(0.36, elbowY);
  points[14] = point(0.64, elbowY);
  points[15] = point(0.3, 0.75);
  points[16] = point(0.7, 0.75);
  points[23] = point(0.46, 0.48);
  points[24] = point(0.54, 0.48);
  points[27] = point(0.49, 0.72, 0.8);
  points[28] = point(0.51, 0.72, 0.8);
  return points;
}

test('measurements are normalized to body size and do not require knees', () => {
  const points = pose();
  points[25] = point(0, 0, 0);
  points[26] = point(0, 0, 0);
  const measured = measureTechniqueFrame(points, 1, 9 / 16);
  assert.ok(measured);
  assert.equal(measured.footSupportVisible, true);
  assert.ok((measured.handWidthRatio ?? 0) > 1);
  assert.ok(Number.isFinite(measured.bodyLineDeviation));
});

test('rep extraction requires a complete top to bottom cycle', () => {
  const base = (angle: number): TechniqueFrameMetrics => ({
    timeSeconds: 0,
    poseConfidence: 0.9,
    elbowAngle: angle,
    leftElbowAngle: angle,
    rightElbowAngle: angle,
    elbowAsymmetry: 0,
    handWidthRatio: 1.2,
    bodyLineDeviation: 0.03,
    shoulderToHandsRatio: 1,
    footSupportVisible: true,
  });
  assert.equal(countCompleteReps([base(160), base(130), base(105), base(130), base(160), base(100)]), 2);
  assert.equal(countCompleteReps([base(130), base(100)]), 0);
});

test('reference profile exposes robust percentile ranges', () => {
  const frames = [100, 110, 120, 130, 160, 100].map((angle, index): TechniqueFrameMetrics => ({
    timeSeconds: index,
    poseConfidence: 0.9,
    elbowAngle: angle,
    leftElbowAngle: angle,
    rightElbowAngle: angle,
    elbowAsymmetry: 0,
    handWidthRatio: 1.25,
    bodyLineDeviation: 0.02,
    shoulderToHandsRatio: 1,
    footSupportVisible: true,
  }));
  const profile = buildReferenceProfile({ frames, sourceCount: 3, variation: 'standard', view: 'side' });
  const prompt = profileForPrompt(profile);
  assert.equal(profile.sourceCount, 3);
  assert.equal(profile.repCount, 1);
  assert.deepEqual(prompt.ranges.handWidthRatio.typical, [1.25, 1.25]);
});
