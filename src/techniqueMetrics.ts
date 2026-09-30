export type TechniqueView = 'front' | 'side' | 'diagonal';
export type PushupVariation = 'standard' | 'wide' | 'narrow' | 'incline' | 'knee' | 'plyometric' | 'unknown';

export type PosePoint = {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
};

export type TechniqueFrameMetrics = {
  timeSeconds: number;
  poseConfidence: number;
  elbowAngle: number | null;
  leftElbowAngle: number | null;
  rightElbowAngle: number | null;
  elbowAsymmetry: number | null;
  handWidthRatio: number | null;
  bodyLineDeviation: number | null;
  shoulderToHandsRatio: number | null;
  footSupportVisible: boolean;
};

export type TechniqueMetricDistribution = {
  sampleCount: number;
  p10: number;
  p25: number;
  median: number;
  p75: number;
  p90: number;
};

export type TechniqueReferenceProfile = {
  version: number;
  variation: PushupVariation;
  view: TechniqueView;
  sourceCount: number;
  repCount: number;
  metrics: Partial<Record<TechniqueMetricName, TechniqueMetricDistribution>>;
};

export type TechniqueMetricName = Exclude<keyof TechniqueFrameMetrics, 'timeSeconds' | 'poseConfidence' | 'footSupportVisible'>;

const metricNames: TechniqueMetricName[] = [
  'elbowAngle',
  'leftElbowAngle',
  'rightElbowAngle',
  'elbowAsymmetry',
  'handWidthRatio',
  'bodyLineDeviation',
  'shoulderToHandsRatio',
];

const visible = (point: PosePoint | undefined, minimum = 0.45): point is PosePoint =>
  Boolean(point && Number.isFinite(point.x) && Number.isFinite(point.y) && (point.visibility ?? 1) >= minimum);

const pointDistance = (a: PosePoint, b: PosePoint, aspectRatio: number) =>
  Math.hypot((a.x - b.x) * aspectRatio, a.y - b.y);

const midpoint = (a: PosePoint, b: PosePoint): PosePoint => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
  visibility: Math.min(a.visibility ?? 1, b.visibility ?? 1),
});

const jointAngle = (a: PosePoint, b: PosePoint, c: PosePoint, aspectRatio: number) => {
  const ux = (a.x - b.x) * aspectRatio;
  const uy = a.y - b.y;
  const vx = (c.x - b.x) * aspectRatio;
  const vy = c.y - b.y;
  const length = Math.hypot(ux, uy) * Math.hypot(vx, vy);
  if (length < 0.0001) return null;
  return Math.acos(Math.max(-1, Math.min(1, (ux * vx + uy * vy) / length))) * 180 / Math.PI;
};

const normalizedLineDistance = (point: PosePoint, start: PosePoint, end: PosePoint, aspectRatio: number) => {
  const px = point.x * aspectRatio;
  const sx = start.x * aspectRatio;
  const ex = end.x * aspectRatio;
  const dx = ex - sx;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length < 0.025) return null;
  return Math.abs(dy * px - dx * point.y + ex * start.y - end.y * sx) / (length * length);
};

/**
 * Converts one MediaPipe pose into body-size-normalized measurements.
 * Knees are deliberately absent: they are unreliable under frontal torso
 * occlusion and are never required for counting a repetition.
 */
export function measureTechniqueFrame(
  points: PosePoint[] | undefined,
  timeSeconds: number,
  aspectRatio = 1,
): TechniqueFrameMetrics | null {
  if (!points || !Number.isFinite(aspectRatio) || aspectRatio <= 0) return null;
  const leftShoulder = points[11];
  const rightShoulder = points[12];
  if (!visible(leftShoulder) || !visible(rightShoulder)) return null;

  const elbow = (ids: [number, number, number]) => {
    const [a, b, c] = ids.map(index => points[index]);
    return visible(a, 0.52) && visible(b, 0.52) && visible(c, 0.52)
      ? jointAngle(a, b, c, aspectRatio)
      : null;
  };
  const leftElbowAngle = elbow([11, 13, 15]);
  const rightElbowAngle = elbow([12, 14, 16]);
  const availableAngles = [leftElbowAngle, rightElbowAngle].filter((value): value is number => value !== null);
  const elbowAngle = availableAngles.length
    ? availableAngles.reduce((sum, value) => sum + value, 0) / availableAngles.length
    : null;

  const shoulderWidth = pointDistance(leftShoulder, rightShoulder, aspectRatio);
  const leftWrist = points[15];
  const rightWrist = points[16];
  const handWidthRatio = shoulderWidth > 0.015 && visible(leftWrist, 0.45) && visible(rightWrist, 0.45)
    ? pointDistance(leftWrist, rightWrist, aspectRatio) / shoulderWidth
    : null;

  const shoulder = midpoint(leftShoulder, rightShoulder);
  const hip = visible(points[23], 0.35) && visible(points[24], 0.35) ? midpoint(points[23], points[24]) : null;
  const ankleCandidates = [points[27], points[28], points[29], points[30], points[31], points[32]]
    .filter((point): point is PosePoint => visible(point, 0.08));
  const ankle = ankleCandidates.length
    ? ankleCandidates.reduce((best, point) => (point.visibility ?? 0) > (best.visibility ?? 0) ? point : best)
    : null;
  const bodyLineDeviation = hip && ankle ? normalizedLineDistance(hip, shoulder, ankle, aspectRatio) : null;

  const wristMid = visible(leftWrist, 0.45) && visible(rightWrist, 0.45) ? midpoint(leftWrist, rightWrist) : null;
  const shoulderToHandsRatio = wristMid && shoulderWidth > 0.015
    ? Math.abs(shoulder.y - wristMid.y) / shoulderWidth
    : null;
  const confidence = Math.min(leftShoulder.visibility ?? 1, rightShoulder.visibility ?? 1);

  return {
    timeSeconds,
    poseConfidence: confidence,
    elbowAngle,
    leftElbowAngle,
    rightElbowAngle,
    elbowAsymmetry: leftElbowAngle !== null && rightElbowAngle !== null
      ? Math.abs(leftElbowAngle - rightElbowAngle)
      : null,
    handWidthRatio,
    bodyLineDeviation,
    shoulderToHandsRatio,
    footSupportVisible: Boolean(ankle),
  };
}

export function countCompleteReps(frames: TechniqueFrameMetrics[], topAngle = 150, bottomAngle = 115) {
  let armed = false;
  let count = 0;
  for (const frame of frames) {
    if (frame.elbowAngle === null || frame.poseConfidence < 0.45) continue;
    if (frame.elbowAngle >= topAngle) armed = true;
    else if (armed && frame.elbowAngle <= bottomAngle) {
      count += 1;
      armed = false;
    }
  }
  return count;
}

const quantile = (sorted: number[], q: number) => {
  if (!sorted.length) return 0;
  const index = (sorted.length - 1) * q;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
};

export function distribution(values: number[]): TechniqueMetricDistribution | null {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  return {
    sampleCount: sorted.length,
    p10: quantile(sorted, 0.1),
    p25: quantile(sorted, 0.25),
    median: quantile(sorted, 0.5),
    p75: quantile(sorted, 0.75),
    p90: quantile(sorted, 0.9),
  };
}

export function buildReferenceProfile({
  frames,
  sourceCount,
  variation,
  view,
  version = 1,
}: {
  frames: TechniqueFrameMetrics[];
  sourceCount: number;
  variation: PushupVariation;
  view: TechniqueView;
  version?: number;
}): TechniqueReferenceProfile {
  const metrics: TechniqueReferenceProfile['metrics'] = {};
  for (const name of metricNames) {
    const values = frames.map(frame => frame[name]).filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
    const value = distribution(values);
    if (value) metrics[name] = value;
  }
  return { version, variation, view, sourceCount, repCount: countCompleteReps(frames), metrics };
}

export function profileForPrompt(profile: TechniqueReferenceProfile) {
  return {
    version: profile.version,
    variation: profile.variation,
    view: profile.view,
    sourceCount: profile.sourceCount,
    repCount: profile.repCount,
    ranges: Object.fromEntries(Object.entries(profile.metrics).map(([name, value]) => [name, {
      typical: [value!.p25, value!.p75],
      observed: [value!.p10, value!.p90],
      samples: value!.sampleCount,
    }])),
  };
}
