import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { WebView } from 'react-native-webview';
import { makeCameraHtml } from './cameraHtml';
export type CameraEvent = { type: 'ready' | 'status' | 'error' | 'pose' | 'complete'; message?: string; width?: number; height?: number; observation?: import('./counter').Observation | null; trace?: import('./coachEngineMetrics').PoseTraceItem[]; frames?: import('./videoFrames').CoachVideoFrame[] };
export type CameraFeedHandle = { startCapture: () => void; pauseCapture: () => void; completeCapture: () => void };
const CameraFeed = forwardRef<CameraFeedHandle, { onEvent: (event: CameraEvent) => void; testVideo?: string }>(function CameraFeed({ onEvent, testVideo = '' }, forwardedRef) {
  const ref=useRef<WebView>(null);
  const command=(value:string)=>ref.current?.postMessage(value);
  useImperativeHandle(forwardedRef,()=>({startCapture:()=>command('capture:start'),pauseCapture:()=>command('capture:pause'),completeCapture:()=>command('capture:complete')}),[]);
  const localVideo=testVideo.startsWith('file:')||testVideo.startsWith('content:');
  useEffect(()=>()=>{
    // Android WebView can keep getUserMedia alive after a route loses focus.
    // Release it explicitly so the next workout can claim the front camera.
    ref.current?.postMessage('stop');
    ref.current?.injectJavaScript('window.__repStop?.(); true;');
  },[]);
  return <WebView ref={ref} source={{ html: makeCameraHtml(testVideo), baseUrl: localVideo?'file:///':'https://rep.local' }} originWhitelist={['*']} onShouldStartLoadWithRequest={request => request.url === 'about:blank' || request.url.startsWith('https://rep.local') || request.url.startsWith('file:') || request.url.startsWith('content:')} javaScriptEnabled allowFileAccess allowUniversalAccessFromFileURLs allowsInlineMediaPlayback mediaPlaybackRequiresUserAction={false} mediaCapturePermissionGrantType="grantIfSameHostElsePrompt" scrollEnabled={false} style={{ flex: 1, backgroundColor: '#0a100e' }} onMessage={e => { try { onEvent(JSON.parse(e.nativeEvent.data)); } catch {} }} onError={() => onEvent({ type: 'error', message: 'Не удалось открыть камеру. Попробуй ещё раз.' })} />;
});
export default CameraFeed;
