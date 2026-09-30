export const COACH_FRAME_COUNT = 12;

export type CoachFramePlanItem = {
  index: number;
  timeSeconds: number;
};

export function sampleFrameTimes(durationSeconds: number, count = COACH_FRAME_COUNT) {
  const safeDuration = Number.isFinite(durationSeconds) && durationSeconds > 0 ? durationSeconds : 10;
  const safeCount = Math.max(1, Math.min(12, Math.round(count)));
  // Avoid the first and last frames: they are often black while the camera starts/stops.
  return Array.from({ length: safeCount }, (_, index) =>
    safeDuration * ((index + 1) / (safeCount + 1))
  );
}

export function sampleFramePlan(durationSeconds: number, count = COACH_FRAME_COUNT): CoachFramePlanItem[] {
  return sampleFrameTimes(durationSeconds, count).map((timeSeconds, index) => ({
    index: index + 1,
    timeSeconds,
  }));
}
