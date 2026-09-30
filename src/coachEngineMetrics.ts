import type { Observation } from './counter';
import { countCompleteReps, distribution, type TechniqueFrameMetrics } from './techniqueMetrics';

export type PoseTraceItem = { t: number; missing?: boolean } & Partial<Observation>;

export type CoachEngineMetrics = {
  version: 1;
  durationSeconds: number;
  sampledFrames: number;
  detectedFrames: number;
  poseCoverage: number;
  footCoverage: number;
  estimatedCompleteReps: number;
  metrics: Record<string, ReturnType<typeof distribution>>;
};

export function summarizePoseTrace(trace: PoseTraceItem[]): CoachEngineMetrics | null {
  if (!trace.length) return null;
  const detected = trace.filter(item => !item.missing && Number.isFinite(item.elbowAngle));
  if (detected.length < 3) return null;
  const frames: TechniqueFrameMetrics[] = detected.map(item => ({
    timeSeconds: Number(item.t) || 0,
    poseConfidence: Number(item.confidence) || 0,
    elbowAngle: Number.isFinite(item.elbowAngle) ? Number(item.elbowAngle) : null,
    leftElbowAngle: Number.isFinite(item.leftElbowAngle) ? Number(item.leftElbowAngle) : null,
    rightElbowAngle: Number.isFinite(item.rightElbowAngle) ? Number(item.rightElbowAngle) : null,
    elbowAsymmetry: Number.isFinite(item.elbowAsymmetry) ? Number(item.elbowAsymmetry) : null,
    handWidthRatio: Number.isFinite(item.handWidthRatio) ? Number(item.handWidthRatio) : null,
    bodyLineDeviation: Number.isFinite(item.bodyLineDeviation) ? Number(item.bodyLineDeviation) : null,
    shoulderToHandsRatio: Number.isFinite(item.shoulderToHandsRatio) ? Number(item.shoulderToHandsRatio) : null,
    footSupportVisible: item.feetVisible === true,
  }));
  const values = (name: keyof TechniqueFrameMetrics) => frames
    .map(frame => frame[name])
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  return {
    version: 1,
    durationSeconds: Math.max(...trace.map(item => Number(item.t) || 0)),
    sampledFrames: trace.length,
    detectedFrames: detected.length,
    poseCoverage: detected.length / trace.length,
    footCoverage: detected.filter(item => item.feetVisible === true).length / detected.length,
    estimatedCompleteReps: countCompleteReps(frames),
    metrics: {
      elbowAngle: distribution(values('elbowAngle')),
      elbowAsymmetry: distribution(values('elbowAsymmetry')),
      handWidthRatio: distribution(values('handWidthRatio')),
      bodyLineDeviation: distribution(values('bodyLineDeviation')),
      shoulderToHandsRatio: distribution(values('shoulderToHandsRatio')),
    },
  };
}
