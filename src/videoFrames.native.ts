import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { createVideoPlayer, type VideoPlayer } from 'expo-video';
import { COACH_FRAME_COUNT, sampleFramePlan } from './videoFrameSampling';
import type { CoachVideoAsset } from './coachVideo';
import type { CoachVideoFrame } from './videoFrames';

const LOAD_TIMEOUT_MS = 15_000;

function waitUntilReady(player: VideoPlayer) {
  if (player.status === 'readyToPlay') return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      subscription.remove();
      reject(new Error('Не удалось открыть видео для разбора.')); 
    }, LOAD_TIMEOUT_MS);
    const subscription = player.addListener('statusChange', ({ status, error }) => {
      if (status !== 'readyToPlay' && status !== 'error') return;
      clearTimeout(timeout);
      subscription.remove();
      if (status === 'error') reject(new Error(error?.message || 'Не удалось открыть видео для разбора.'));
      else resolve();
    });
  });
}

export async function extractVideoFrames(asset: CoachVideoAsset): Promise<CoachVideoFrame[]> {
  const player = createVideoPlayer({ uri: asset.uri });
  try {
    await waitUntilReady(player);
    const duration = player.duration > 0 ? player.duration : Math.max(1, (asset.duration ?? 10_000) / 1000);
    const plan = sampleFramePlan(duration);
    const thumbnails = await player.generateThumbnailsAsync(plan.map(item => item.timeSeconds), {
      maxWidth: 768,
      maxHeight: 768,
    });
    try {
      const frames: CoachVideoFrame[] = [];
      for (const [position, thumbnail] of thumbnails.slice(0, COACH_FRAME_COUNT).entries()) {
        const context = ImageManipulator.manipulate(thumbnail);
        try {
          const image = await context.renderAsync();
          try {
            const result = await image.saveAsync({ base64: true, compress: 0.72, format: SaveFormat.JPEG });
            const framePlan = plan[position];
            if (result.base64 && framePlan) frames.push({
              dataUrl: `data:image/jpeg;base64,${result.base64}`,
              index: framePlan.index,
              timeSeconds: framePlan.timeSeconds,
            });
          } finally {
            image.release();
          }
        } finally {
          context.release();
        }
      }
      if (frames.length < 3) throw new Error('Не получилось извлечь достаточно кадров из видео.');
      return frames;
    } finally {
      thumbnails.forEach(thumbnail => thumbnail.release());
    }
  } finally {
    player.release();
  }
}
