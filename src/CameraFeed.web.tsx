import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { makeCameraHtml } from './cameraHtml';
import type { CameraEvent, CameraFeedHandle } from './CameraFeed';
const CameraFeed = forwardRef<CameraFeedHandle, { onEvent: (event: CameraEvent) => void; testVideo?: string }>(function CameraFeed({ onEvent, testVideo: providedTestVideo }, forwardedRef) {
  const frame = useRef<HTMLIFrameElement>(null);
  const testVideo = providedTestVideo ?? (typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('testVideo') ?? '');
  useEffect(() => {
    const listener = (e: MessageEvent) => { if (e.source === frame.current?.contentWindow && e.data?.source === 'rep-camera') onEvent(e.data.data); };
    window.addEventListener('message', listener); return () => window.removeEventListener('message', listener);
  }, [onEvent]);
  useImperativeHandle(forwardedRef,()=>({
    startCapture:()=>frame.current?.contentWindow?.postMessage('capture:start','*'),
    pauseCapture:()=>frame.current?.contentWindow?.postMessage('capture:pause','*'),
    completeCapture:()=>frame.current?.contentWindow?.postMessage('capture:complete','*'),
  }),[]);
  return <iframe ref={frame} title="Камера для подсчёта отжиманий" srcDoc={makeCameraHtml(testVideo)} allow="camera; autoplay" style={{ width: '100%', height: '100%', border: 0 }} />;
});
export default CameraFeed;
