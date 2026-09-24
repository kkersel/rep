import React from 'react';
import { WebView } from 'react-native-webview';
import { cameraHtml } from './cameraHtml';
export type CameraEvent = { type: 'ready' | 'status' | 'error' | 'pose'; message?: string; width?: number; height?: number; observation?: import('./counter').Observation | null };
export default function CameraFeed({ onEvent }: { onEvent: (event: CameraEvent) => void }) {
  return <WebView source={{ html: cameraHtml, baseUrl: 'https://rep.local' }} originWhitelist={['*']} onShouldStartLoadWithRequest={request => request.url === 'about:blank' || request.url.startsWith('https://rep.local')} javaScriptEnabled allowsInlineMediaPlayback mediaPlaybackRequiresUserAction={false} mediaCapturePermissionGrantType="grantIfSameHostElsePrompt" scrollEnabled={false} style={{ flex: 1, backgroundColor: '#0a100e' }} onMessage={e => { try { onEvent(JSON.parse(e.nativeEvent.data)); } catch {} }} onError={() => onEvent({ type: 'error', message: 'Не удалось открыть камеру. Попробуй ещё раз.' })} />;
}
