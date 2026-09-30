import { COACH_FRAME_COUNT, sampleFramePlan } from './videoFrameSampling';
import type { CoachVideoAsset } from './coachVideo';
import type { CoachVideoFrame } from './videoFrames';

const waitFor = (target: HTMLVideoElement, event: 'loadedmetadata' | 'seeked' | 'error') =>
  new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      target.removeEventListener(event, done);
      target.removeEventListener('error', failed);
    };
    const done = () => { cleanup(); resolve(); };
    const failed = () => { cleanup(); reject(new Error('Не удалось открыть видео для разбора.')); };
    target.addEventListener(event, done, { once: true });
    if (event !== 'error') target.addEventListener('error', failed, { once: true });
  });

export async function extractVideoFrames(asset: CoachVideoAsset): Promise<CoachVideoFrame[]> {
  const ownedUrl = asset.file ? URL.createObjectURL(asset.file) : '';
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.src = ownedUrl || asset.uri;

  try {
    if (video.readyState < 1) {
      video.load();
      await waitFor(video, 'loadedmetadata');
    }
    if (!Number.isFinite(video.duration) || video.duration <= 0) throw new Error('Не удалось определить длину видео.');

    const scale = Math.min(1, 768 / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Браузер не смог подготовить кадры.');

    const frames: CoachVideoFrame[] = [];
    for (const frame of sampleFramePlan(video.duration, COACH_FRAME_COUNT)) {
      video.currentTime = frame.timeSeconds;
      await waitFor(video, 'seeked');
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      frames.push({
        dataUrl: canvas.toDataURL('image/jpeg', 0.72),
        index: frame.index,
        timeSeconds: frame.timeSeconds,
      });
    }
    return frames;
  } finally {
    video.removeAttribute('src');
    video.load();
    if (ownedUrl) URL.revokeObjectURL(ownedUrl);
  }
}
