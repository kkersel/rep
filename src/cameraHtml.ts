import { observePoseSource } from './poseObservation';
// Model and WASM are fetched once per camera mount. Video frames stay on device.
export function makeCameraHtml(testVideoUrl = '') {
return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><style>
html,body{margin:0;background:#0a100e;height:100%;overflow:hidden}video,canvas{position:absolute;width:100%;height:100%;object-fit:contain;transform:scaleX(-1)}
</style></head><body><video autoplay playsinline muted></video><canvas></canvas><script type="module">
const observePose = ${observePoseSource};
const testVideoUrl = ${JSON.stringify(testVideoUrl)};
const send = data => { const value=JSON.stringify(data); if(window.ReactNativeWebView) window.ReactNativeWebView.postMessage(value); else window.parent.postMessage({source:'rep-camera',data},'*'); };
const video=document.querySelector('video'), canvas=document.querySelector('canvas'), ctx=canvas.getContext('2d');
const trace=[]; const traceNode=document.createElement('pre'); traceNode.setAttribute('aria-label','pose-trace'); traceNode.style.cssText='position:fixed;left:0;top:0;width:1px;height:1px;opacity:.01;overflow:hidden;font-size:1px'; if(testVideoUrl)document.body.append(traceNode);
let stream, detector, stopped=false, last=0, previous=-1, testStarted=!testVideoUrl, testStable=0;
function stop(){ stopped=true; stream?.getTracks().forEach(t=>t.stop()); detector?.close(); }
window.addEventListener('pagehide',stop);
document.addEventListener('visibilitychange',()=>{ if(document.hidden) {stop();send({type:'error',message:'Камера остановлена. Открой её заново для продолжения.'});} });
try {
 send({type:'status',message:'Загружаем распознавание…'});
 const {FilesetResolver,PoseLandmarker}=await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/vision_bundle.mjs');
 const vision=await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm');
 detector=await PoseLandmarker.createFromOptions(vision,{baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',delegate:'CPU'},runningMode:'VIDEO',numPoses:1,minPoseDetectionConfidence:.4,minTrackingConfidence:.4});
 if(stopped) {detector.close();} else {
 if(testVideoUrl){
  video.autoplay=false; video.src=testVideoUrl; video.loop=true; video.muted=true;
  await new Promise((resolve,reject)=>{video.addEventListener('loadeddata',resolve,{once:true});video.addEventListener('error',reject,{once:true});video.load();});
  video.addEventListener('ended',()=>{traceNode.textContent='POSE_TRACE '+JSON.stringify(trace)});
  video.currentTime=0; testStarted=true; await video.play();
 } else {
  stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',resizeMode:{ideal:'none'}},audio:false});
  if(stopped) stream.getTracks().forEach(t=>t.stop());
  const track=stream.getVideoTracks()[0];
  const capabilities=track.getCapabilities?.() || {};
  if(capabilities.zoom && Number.isFinite(capabilities.zoom.min)) {
   try { await track.applyConstraints({advanced:[{zoom:capabilities.zoom.min}]}); } catch { /* Keep the available native camera view. */ }
  }
  video.srcObject=stream; await video.play();
 }
 if(!stopped) {
 send({type:'ready',width:video.videoWidth,height:video.videoHeight});
 function frame(now){
  if(stopped)return;
  if(now-last>80 && video.readyState>=2 && (!testStarted || previous!==video.currentTime)){
   last=now; previous=video.currentTime;
   try {
    const result=detector.detectForVideo(video,now); const p=result.landmarks[0];
    canvas.width=video.videoWidth; canvas.height=video.videoHeight;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    const w=canvas.width,h=canvas.height;
    const vh=h,oy=0;
    const fx=w*.025,fy=h*.025,fw=w*.95,fh=h*.95;
    const border=ctx.createLinearGradient(fx,fy,fx+fw,fy+fh);border.addColorStop(0,'#0A84FF');border.addColorStop(1,'#64D2FF');
    ctx.fillStyle='rgba(9,15,13,.48)';ctx.beginPath();ctx.rect(0,0,w,h);ctx.roundRect(fx,fy,fw,fh,28);ctx.fill('evenodd');
    ctx.strokeStyle=border;ctx.lineWidth=2;ctx.shadowColor='#0A84FF';ctx.shadowBlur=8;ctx.beginPath();ctx.roundRect(fx,fy,fw,fh,28);ctx.stroke();ctx.shadowBlur=0;
    if(p){
     const links=[[11,12],[11,13],[13,15],[12,14],[14,16]];
     ctx.lineCap='round';ctx.lineJoin='round';
     for(const [a,b] of links){
      if(p[a].visibility>.6&&p[b].visibility>.6){
       const ax=p[a].x*w,ay=p[a].y*h,bx=p[b].x*w,by=p[b].y*h;
       const ribbon=ctx.createLinearGradient(ax,ay,bx,by);ribbon.addColorStop(0,'#0A84FF');ribbon.addColorStop(1,'#64D2FF');
       ctx.strokeStyle='rgba(9,18,15,.55)';ctx.lineWidth=13;ctx.beginPath();ctx.moveTo(ax,ay);ctx.quadraticCurveTo((ax+bx)/2,(ay+by)/2-4,bx,by);ctx.stroke();
       ctx.strokeStyle=ribbon;ctx.shadowColor='#0A84FF';ctx.shadowBlur=10;ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(ax,ay);ctx.quadraticCurveTo((ax+bx)/2,(ay+by)/2-4,bx,by);ctx.stroke();ctx.shadowBlur=0;
      }
     }
     const pulse=2+Math.sin(now/140)*1.5;
     for(const i of [11,12,13,14,15,16]){if(p[i].visibility>.5){const x=p[i].x*w,y=p[i].y*h;ctx.fillStyle='#FFFFFF';ctx.shadowColor='#0A84FF';ctx.shadowBlur=12;ctx.beginPath();ctx.arc(x,y,5+pulse,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.strokeStyle='#0A84FF';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,10+pulse,0,Math.PI*2);ctx.stroke();}}
     const legChains=[[23,25,27],[24,26,28]];
     const leg=legChains.map(ids=>{const hip=p[ids[0]],knee=p[ids[1]],ankle=p[ids[2]],length=Math.hypot((hip.x-ankle.x)*(w/h),hip.y-ankle.y);return{ids,score:(knee.visibility||0)+(ankle.visibility||0),valid:hip.visibility>=.55&&knee.visibility>=.1&&ankle.visibility>=.06&&length>.04};}).sort((a,b)=>b.score-a.score)[0];
     if(leg&&leg.valid){
      const ankles=[p[27],p[28]].filter(point=>point&&point.visibility>=.06);
      const anchor=ankles.length?ankles: [p[leg.ids[2]]];
      const cx=anchor.reduce((sum,point)=>sum+point.x*w,0)/anchor.length,cy=anchor.reduce((sum,point)=>sum+point.y*h,0)/anchor.length;
      const detectedSpan=ankles.length===2?Math.abs(ankles[0].x-ankles[1].x)*w:0;
      const half=Math.max(w*.09,detectedSpan*.72);const x1=Math.max(16,cx-half),x2=Math.min(w-16,cx+half);
      const legGlow=ctx.createLinearGradient(x1,cy,x2,cy);legGlow.addColorStop(0,'#64D2FF');legGlow.addColorStop(.5,'#FFFFFF');legGlow.addColorStop(1,'#34C759');
      ctx.lineCap='round';ctx.strokeStyle='rgba(9,18,15,.62)';ctx.lineWidth=15;ctx.beginPath();ctx.moveTo(x1,cy);ctx.lineTo(x2,cy);ctx.stroke();
      ctx.strokeStyle=legGlow;ctx.shadowColor='#34C759';ctx.shadowBlur=14;ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(x1,cy);ctx.lineTo(x2,cy);ctx.stroke();ctx.shadowBlur=0;
      for(const x of [x1,x2]){ctx.fillStyle='#FFFFFF';ctx.shadowColor='#34C759';ctx.shadowBlur=12;ctx.beginPath();ctx.arc(x,cy,5+pulse,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.strokeStyle='#34C759';ctx.lineWidth=3;ctx.beginPath();ctx.arc(x,cy,10+pulse,0,Math.PI*2);ctx.stroke();}
     }
     const observation=observePose(p,w/h);
     if(testVideoUrl){trace.push({t:+video.currentTime.toFixed(3),...observation,legPoints:[23,24,25,26,27,28].map(i=>({x:+p[i].x.toFixed(3),y:+p[i].y.toFixed(3),v:+(p[i].visibility||0).toFixed(3)}))});traceNode.textContent='POSE_TRACE '+JSON.stringify(trace);}
     send({type:'pose',observation});
     if(!testStarted){
      // The fixture runner only waits for a stable person/arm lock. Leg validity is
      // deliberately left to the real counter so test clips can expose failures.
      const stable=observation&&observation.armConfidence>=.55&&observation.confidence>=.55;
      testStable=stable?testStable+1:0;
      if(testStable>=3){testStarted=true;previous=-1;video.play().catch(()=>send({type:'error',message:'Не удалось запустить тестовое видео.'}));}
     }
    }else {if(testVideoUrl){trace.push({t:+video.currentTime.toFixed(3),missing:true});traceNode.textContent='POSE_TRACE '+JSON.stringify(trace);}send({type:'pose',observation:null});}
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
