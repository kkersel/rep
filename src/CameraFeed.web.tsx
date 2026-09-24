import React, { useEffect, useRef } from 'react';
import { makeCameraHtml } from './cameraHtml';
import type { CameraEvent } from './CameraFeed';
export default function CameraFeed({ onEvent }: { onEvent: (event: CameraEvent) => void }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const testVideo = typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('testVideo') ?? '';
  useEffect(() => {
    const listener = (e: MessageEvent) => { if (e.source === frame.current?.contentWindow && e.data?.source === 'rep-camera') onEvent(e.data.data); };
    window.addEventListener('message', listener); return () => window.removeEventListener('message', listener);
  }, [onEvent]);
  return <iframe ref={frame} title="Камера для подсчёта отжиманий" srcDoc={makeCameraHtml(testVideo)} allow="camera; autoplay" style={{ width: '100%', height: '100%', border: 0 }} />;
}
