import { readFileSync } from 'node:fs';
import { RepCounter } from '../src/counter';
import { observePoseSource } from '../src/poseObservation';

const observePose = new Function(`return (${observePoseSource})`)() as (
  points: Array<{ x: number; y: number; z?: number; visibility: number }> | undefined,
  aspectRatio?: number,
) => import('../src/counter').Observation | null;

type TraceFrame = {
  timeSeconds: number;
  aspectRatio: number;
  landmarks: Parameters<typeof observePose>[0];
};

const input = process.argv[2];
if (!input) throw new Error('Usage: tsx scripts/analyze-pose-trace.ts trace.json');

const frames = JSON.parse(readFileSync(input, 'utf8')) as TraceFrame[];
const counter = new RepCounter();
const observations = frames.map(frame => ({
  time: frame.timeSeconds,
  observation: observePose(frame.landmarks, frame.aspectRatio),
}));
const valid = observations.filter(item => Number.isFinite(item.observation?.elbowAngle));
const feet = valid.filter(item => item.observation?.feetVisible);
const angles = valid.map(item => item.observation!.elbowAngle!);
const events: Array<Record<string, unknown>> = [];
let previousPhase = counter.phase;

for (const item of observations) {
  const counted = counter.update(item.observation, item.time * 1000);
  if (counted || previousPhase !== counter.phase) {
    events.push({
      time: Number(item.time.toFixed(2)),
      phase: `${previousPhase} -> ${counter.phase}`,
      angle: item.observation?.elbowAngle === undefined ? null : Number(item.observation.elbowAngle.toFixed(1)),
      shoulderY: item.observation ? Number(item.observation.y.toFixed(3)) : null,
      footY: item.observation?.footY === undefined ? null : Number(item.observation.footY.toFixed(3)),
      feet: item.observation?.feetVisible ?? false,
      needsFeet: counter.needsFeet,
      needsBodyMovement: counter.needsBodyMovement,
      needsFullPlank: counter.needsFullPlank,
      counted,
    });
  }
  previousPhase = counter.phase;
}

console.log(JSON.stringify({
  frames: frames.length,
  validArmFrames: valid.length,
  footFrames: feet.length,
  footCoverage: valid.length ? Number((feet.length / valid.length).toFixed(3)) : 0,
  angleMin: angles.length ? Number(Math.min(...angles).toFixed(1)) : null,
  angleMax: angles.length ? Number(Math.max(...angles).toFixed(1)) : null,
  count: counter.count,
  finalPhase: counter.phase,
  needsFeet: counter.needsFeet,
  needsBodyMovement: counter.needsBodyMovement,
  needsFullPlank: counter.needsFullPlank,
  events,
}, null, 2));
