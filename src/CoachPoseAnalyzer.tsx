import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import CameraFeed, { type CameraEvent } from './CameraFeed';
import { summarizePoseTrace, type CoachEngineMetrics } from './coachEngineMetrics';
import type { CoachVideoAsset } from './coachVideo';

export type CoachPoseAnalyzerHandle = {
  analyze: (video: CoachVideoAsset) => Promise<CoachEngineMetrics | null>;
};

type Request = {
  id: number;
  uri: string;
  resolve: (value: CoachEngineMetrics | null) => void;
};

const CoachPoseAnalyzer = forwardRef<CoachPoseAnalyzerHandle>(function CoachPoseAnalyzer(_props, ref) {
  const [request, setRequest] = useState<Request | null>(null);
  const nextId = useRef(0);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ownedUrl = useRef('');

  const finish = (value: CoachEngineMetrics | null) => {
    if (!request) return;
    if (timeout.current) clearTimeout(timeout.current);
    request.resolve(value);
    setRequest(null);
    if (ownedUrl.current && Platform.OS === 'web') URL.revokeObjectURL(ownedUrl.current);
    ownedUrl.current = '';
  };

  useImperativeHandle(ref, () => ({
    analyze(video) {
      if (request) request.resolve(null);
      if (ownedUrl.current && Platform.OS === 'web') URL.revokeObjectURL(ownedUrl.current);
      const uri = Platform.OS === 'web' && video.file
        ? (ownedUrl.current = URL.createObjectURL(video.file))
        : video.uri;
      return new Promise(resolve => {
        setRequest({ id: ++nextId.current, uri, resolve });
      });
    },
  }), [request]);

  useEffect(() => {
    if (!request) return;
    timeout.current = setTimeout(() => finish(null), 30_000);
    return () => { if (timeout.current) clearTimeout(timeout.current); };
    // finish deliberately reads the active request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.id]);

  const onEvent = (event: CameraEvent) => {
    if (event.type === 'complete') finish(summarizePoseTrace(event.trace ?? []));
    else if (event.type === 'error') finish(null);
  };

  return request ? <View pointerEvents="none" style={styles.hidden}>
    <CameraFeed key={request.id} onEvent={onEvent} testVideo={request.uri}/>
  </View> : null;
});

const styles = StyleSheet.create({
  hidden: { position: 'absolute', left: -2, top: -2, width: 2, height: 2, opacity: 0.01, overflow: 'hidden' },
});

export default CoachPoseAnalyzer;
