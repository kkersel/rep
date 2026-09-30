import type { CoachVideoAsset } from './coachVideo';

export type CoachVideoFrame = {
  dataUrl: string;
  index: number;
  timeSeconds: number;
};

// TypeScript fallback. Metro selects videoFrames.native.ts or videoFrames.web.ts.
export async function extractVideoFrames(_asset: CoachVideoAsset): Promise<CoachVideoFrame[]> {
  throw new Error('Извлечение кадров не поддерживается на этом устройстве.');
}
