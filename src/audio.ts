import { useCallback } from 'react';
import { useAudioPlayer } from 'expo-audio';

const repConfirmation = require('../assets/rep-confirm.wav');

export function useRepConfirmationSound() {
  const player = useAudioPlayer(repConfirmation);

  return useCallback(() => {
    player.pause();
    void player.seekTo(0).then(() => player.play()).catch(() => {});
  }, [player]);
}
