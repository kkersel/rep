import { observePoseSource } from './poseObservation';
// Model and WASM are fetched once per camera mount. Video frames stay on device.
export function makeCameraHtml(testVideoUrl = '') {
return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><style>
	html,body{margin:0;background:#050706;height:100%;overflow:hidden}video,canvas{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transform:scaleX(-1)}
</style></head><body><video autoplay playsinline muted></video><canvas></canvas><script type="module">
const observePose = ${observePoseSource};
const testVideoUrl = ${JSON.stringify(testVideoUrl)};
const send = data => { const value=JSON.stringify(data); if(window.ReactNativeWebView) window.ReactNativeWebView.postMessage(value); else window.parent.postMessage({source:'rep-camera',data},'*'); };
const video=document.querySelector('video'), canvas=document.querySelector('canvas'), ctx=canvas.getContext('2d');
const sampleCanvas=document.createElement('canvas'), sampleCtx=sampleCanvas.getContext('2d');
const trace=[]; const traceNode=document.createElement('pre'); traceNode.setAttribute('aria-label','pose-trace'); traceNode.style.cssText='position:fixed;left:0;top:0;width:1px;height:1px;opacity:.01;overflow:hidden;font-size:1px'; if(testVideoUrl)document.body.append(traceNode);
	let stream, detector, stopped=false, last=0, previous=-1, testStarted=!testVideoUrl, testStable=0;
	let guideAlpha=1, stableSince=0, missingSince=0, lastFootGuide=null;
	let captureActive=false,captureStartedAt=0,capturePausedAt=0,capturePausedMs=0,captureLastTrace=0,captureLastShot=-9999,captureSeen=0,captureTrace=[],captureFrames=[];
function captureTime(now){return Math.max(0,(now-captureStartedAt-capturePausedMs)/1000)}
function captureSnapshot(now){
 if(!captureStartedAt||video.readyState<2||!video.videoWidth)return;
 try{
  const width=Math.min(420,video.videoWidth),height=Math.max(1,Math.round(width*video.videoHeight/video.videoWidth));
  sampleCanvas.width=width;sampleCanvas.height=height;sampleCtx.drawImage(video,0,0,width,height);
  const item={dataUrl:sampleCanvas.toDataURL('image/jpeg',.68),timeSeconds:+captureTime(now).toFixed(2)};
  captureSeen++;
  if(captureFrames.length<24)captureFrames.push(item);else{const slot=Math.floor(Math.random()*captureSeen);if(slot<24)captureFrames[slot]=item;}
  captureLastShot=now;
 }catch{}
}
function startCapture(){
 const now=performance.now();
 if(!captureStartedAt){captureStartedAt=now;capturePausedMs=0;captureTrace=[];captureFrames=[];captureSeen=0;captureLastTrace=0;captureLastShot=-9999;}
 else if(capturePausedAt){capturePausedMs+=now-capturePausedAt;capturePausedAt=0;}
 captureActive=true;captureSnapshot(now);
}
function pauseCapture(){if(captureActive){captureActive=false;capturePausedAt=performance.now();}}
function completeCapture(){
 const now=performance.now();captureSnapshot(now);captureActive=false;
 const ordered=captureFrames.sort((a,b)=>a.timeSeconds-b.timeSeconds);
 const chosen=ordered.length<=12?ordered:Array.from({length:12},(_,i)=>ordered[Math.round(i*(ordered.length-1)/11)]);
 send({type:'complete',trace:captureTrace,frames:chosen.map((item,index)=>({...item,index:index+1}))});
}
function stop(){
 stopped=true;
 video.pause();
 stream?.getTracks().forEach(t=>t.stop());
 stream=undefined;
 video.srcObject=null;
 try { detector?.close(); } catch {}
 detector=undefined;
}
window.__repStop=stop;
const receiveCommand=event=>{const command=event.data;if(command==='stop')stop();else if(command==='capture:start')startCapture();else if(command==='capture:pause')pauseCapture();else if(command==='capture:complete')completeCapture();};
window.addEventListener('message',receiveCommand);
document.addEventListener('message',receiveCommand);
window.addEventListener('pagehide',stop);
window.addEventListener('beforeunload',stop);
document.addEventListener('visibilitychange',()=>{ if(document.hidden) {stop();send({type:'error',message:'Камера остановлена. Открой её заново для продолжения.'});} });
try {
 send({type:'status',message:'Запускаем камеру…'});
 // Start the source immediately. Loading MediaPipe and its WASM can take a few
 // seconds on a cold Android WebView, but it must not hold the camera preview.
 const sourceReady=(async()=>{
  if(testVideoUrl){
   video.autoplay=false; video.crossOrigin='anonymous'; video.src=testVideoUrl; video.loop=false; video.muted=true;
   await new Promise((resolve,reject)=>{video.addEventListener('loadeddata',resolve,{once:true});video.addEventListener('error',reject,{once:true});video.load();});
   video.playbackRate=2;
   video.currentTime=0;
  } else {
   stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',resizeMode:{ideal:'none'}},audio:false});
   if(stopped){stream.getTracks().forEach(t=>t.stop());return}
   const track=stream.getVideoTracks()[0];
   const capabilities=track.getCapabilities?.() || {};
   if(capabilities.zoom && Number.isFinite(capabilities.zoom.min)) {
    try { await track.applyConstraints({advanced:[{zoom:capabilities.zoom.min}]}); } catch { /* Keep the available native camera view. */ }
   }
   video.srcObject=stream; await video.play();
   if(!stopped)send({type:'ready',width:video.videoWidth,height:video.videoHeight});
  }
 })();
 send({type:'status',message:'Готовим распознавание…'});
 const {FilesetResolver,PoseLandmarker}=await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/vision_bundle.mjs');
 const vision=await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm');
 detector=await PoseLandmarker.createFromOptions(vision,{baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',delegate:'CPU'},runningMode:'VIDEO',numPoses:1,minPoseDetectionConfidence:.4,minTrackingConfidence:.4});
 await sourceReady;
 if(stopped) {detector.close();detector=undefined;} else {
 if(testVideoUrl){
	 video.addEventListener('ended',()=>{traceNode.textContent='POSE_TRACE '+JSON.stringify(trace);send({type:'complete',trace});});
  video.currentTime=0; testStarted=true; await video.play();
  send({type:'ready',width:video.videoWidth,height:video.videoHeight});
 }
 if(!stopped) {
 function frame(now){
  if(stopped)return;
  if(now-last>80 && video.readyState>=2 && (!testStarted || previous!==video.currentTime)){
   last=now; previous=video.currentTime;
   try {
    const result=detector.detectForVideo(video,now); const p=result.landmarks[0];
    canvas.width=video.videoWidth; canvas.height=video.videoHeight;
    ctx.clearRect(0,0,canvas.width,canvas.height);
	    const w=canvas.width,h=canvas.height;
	    if(p){
	     const observation=observePose(p,w/h);
	     const complete=!!observation&&observation.confidence>=.55&&observation.armConfidence>=.55&&observation.feetVisible===true;
	     if(complete){if(!stableSince)stableSince=now;missingSince=0}else{stableSince=0;if(!missingSince)missingSince=now}
	     const target=complete&&now-stableSince>650?0:!complete&&now-missingSince>320?1:guideAlpha;
	     guideAlpha+=(target-guideAlpha)*.22;
	     const ankles=[p[27],p[29],p[31],p[28],p[30],p[32]].filter(point=>point&&point.x>.005&&point.x<.995&&point.y>.005&&point.y<.995&&point.visibility>=.04);
	     if(ankles.length&&Math.max(...ankles.map(point=>point.visibility))>=.06){
	      const cx=ankles.reduce((sum,point)=>sum+point.x*w,0)/ankles.length,cy=ankles.reduce((sum,point)=>sum+point.y*h,0)/ankles.length;
	      const span=ankles.length===2?Math.abs(ankles[0].x-ankles[1].x)*w:0,half=Math.max(w*.075,span*.7);
	      lastFootGuide={x1:Math.max(14,cx-half),x2:Math.min(w-14,cx+half),y:cy,seen:now};
	     }
	     if(guideAlpha>.025){
	      ctx.save();ctx.globalAlpha=guideAlpha;ctx.lineCap='round';ctx.lineJoin='round';
	      const links=[[11,12],[11,13],[13,15],[12,14],[14,16]];
	      for(const [a,b] of links){if(p[a].visibility>.52&&p[b].visibility>.52){
	       const ax=p[a].x*w,ay=p[a].y*h,bx=p[b].x*w,by=p[b].y*h;
	       ctx.strokeStyle='rgba(2,8,10,.46)';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(ax,ay);ctx.lineTo(bx,by);ctx.stroke();
	       ctx.strokeStyle='rgba(118,221,255,.92)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(ax,ay);ctx.lineTo(bx,by);ctx.stroke();
	      }}
	      for(const i of [11,12,13,14,15,16]){if(p[i].visibility>.52){const x=p[i].x*w,y=p[i].y*h;ctx.fillStyle='#DDF8FF';ctx.beginPath();ctx.arc(x,y,3,0,Math.PI*2);ctx.fill();}}
	      if(lastFootGuide&&now-lastFootGuide.seen<=1500){
	       const footFresh=now-lastFootGuide.seen<220;ctx.setLineDash(footFresh?[]:[7,7]);ctx.strokeStyle=footFresh?'rgba(132,245,196,.94)':'rgba(255,209,102,.9)';ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(lastFootGuide.x1,lastFootGuide.y);ctx.lineTo(lastFootGuide.x2,lastFootGuide.y);ctx.stroke();ctx.setLineDash([]);
	       for(const x of [lastFootGuide.x1,lastFootGuide.x2]){ctx.fillStyle=footFresh?'#84F5C4':'#FFD166';ctx.beginPath();ctx.arc(x,lastFootGuide.y,3,0,Math.PI*2);ctx.fill();}
	      }
	      ctx.restore();
	     }
	     if(testVideoUrl){trace.push({t:+video.currentTime.toFixed(3),rt:+now.toFixed(1),...observation,footPoints:[27,28,29,30,31,32].map(i=>({x:+p[i].x.toFixed(3),y:+p[i].y.toFixed(3),v:+(p[i].visibility||0).toFixed(3)}))});traceNode.textContent='POSE_TRACE '+JSON.stringify(trace);}
     if(captureActive){
      if(now-captureLastTrace>160){captureLastTrace=now;captureTrace.push({t:+captureTime(now).toFixed(3),...observation});if(captureTrace.length>1800)captureTrace.shift();}
      if(now-captureLastShot>900)captureSnapshot(now);
     }
     send({type:'pose',observation});
     if(!testStarted){
      // The fixture runner only waits for a stable person/arm lock. Leg validity is
      // deliberately left to the real counter so test clips can expose failures.
      const stable=observation&&observation.armConfidence>=.55&&observation.confidence>=.55;
      testStable=stable?testStable+1:0;
      if(testStable>=3){testStarted=true;previous=-1;video.play().catch(()=>send({type:'error',message:'Не удалось запустить тестовое видео.'}));}
     }
    }else {if(testVideoUrl){trace.push({t:+video.currentTime.toFixed(3),rt:+now.toFixed(1),missing:true});traceNode.textContent='POSE_TRACE '+JSON.stringify(trace);}if(captureActive&&now-captureLastTrace>160){captureLastTrace=now;captureTrace.push({t:+captureTime(now).toFixed(3),missing:true});if(captureTrace.length>1800)captureTrace.shift();}send({type:'pose',observation:null});}
   }catch(e){stop();send({type:'error',message:'Распознавание прервалось. Перезапусти камеру.'});return;}
  }
  requestAnimationFrame(frame);
 }requestAnimationFrame(frame);
 }
 }
}catch(e){stop();send({type:'error',message:e.name==='NotAllowedError'?'Разреши доступ к камере в настройках устройства или браузера.':'Не удалось запустить камеру или загрузить модель. Проверь интернет и попробуй снова.'});}
</script></body></html>`;
}

export const cameraHtml = makeCameraHtml();
