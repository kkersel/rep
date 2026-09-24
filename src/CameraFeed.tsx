import React, { useEffect, useRef } from 'react';
import { WebView } from 'react-native-webview';
import { cameraHtml } from './cameraHtml';
export type CameraEvent = { type: 'ready' | 'status' | 'error' | 'pose'; message?: string; width?: number; height?: number; observation?: import('./counter').Observation | null };
export default function CameraFeed({ onEvent }: { onEvent: (event: CameraEvent) => void }) {
  const ref=useRef<WebView>(null);
  useEffect(()=>()=>{
    // Android WebView can keep getUserMedia alive after a route loses focus.
    // Release it explicitly so the next workout can claim the front camera.
    ref.current?.postMessage('stop');
    ref.current?.injectJavaScript('window.__repStop?.(); true;');
  },[]);
  return <WebView ref={ref} source={{ html: cameraHtml, baseUrl: 'https://rep.local' }} originWhitelist={['*']} onShouldStartLoadWithRequest={request => request.url === 'about:blank' || request.url.startsWith('https://rep.local')} javaScriptEnabled allowsInlineMediaPlayback mediaPlaybackRequiresUserAction={false} mediaCapturePermissionGrantType="grantIfSameHostElsePrompt" scrollEnabled={false} style={{ flex: 1, backgroundColor: '#0a100e' }} onMessage={e => { try { onEvent(JSON.parse(e.nativeEvent.data)); } catch {} }} onError={() => onEvent({ type: 'error', message: 'Не удалось открыть камеру. Попробуй ещё раз.' })} />;
}
