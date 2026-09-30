import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

export default function SwipeTabPage({
  children,
  onSwipeLeft,
  onSwipeRight,
}: {
  children: React.ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}) {
  const swipe = useMemo(() => Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-24, 24])
    .failOffsetY([-18, 18])
    .onEnd(({ translationX, velocityX }) => {
      if (translationX <= -56 || velocityX <= -550) onSwipeLeft?.();
      else if (translationX >= 56 || velocityX >= 550) onSwipeRight?.();
    }), [onSwipeLeft, onSwipeRight]);

  return <GestureDetector gesture={swipe}><View collapsable={false} style={s.page}>{children}</View></GestureDetector>;
}

const s = StyleSheet.create({ page: { flex: 1 } });
