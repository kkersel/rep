// Shared plain JavaScript: embedded verbatim in WebView, exercised by tests.
export const observePoseSource = `function observePose(points, aspectRatio = 1) {
  if (!points || !points[11] || !points[12] || !Number.isFinite(aspectRatio) || aspectRatio <= 0) return null;
  const left = points[11], right = points[12];
  const inSensor = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y) && p.x > .005 && p.x < .995 && p.y > .005 && p.y < .995;
  if (!inSensor(left) || !inSensor(right)) return null;
  const confidence = Math.min(left.visibility, right.visibility);
  if (!Number.isFinite(confidence)) return null;
  const angles = [];
  for (const [side,ids] of [['left',[11,13,15]],['right',[12,14,16]]]) {
    const a=points[ids[0]],b=points[ids[1]],c=points[ids[2]];
    if (!inSensor(a) || !inSensor(b) || !inSensor(c)) continue;
    const visibility=Math.min(a.visibility,b.visibility,c.visibility);
    if (!Number.isFinite(visibility) || visibility < .55) continue;
    // Normalized x/y have different units: restore the image aspect ratio first.
    const ux=(a.x-b.x)*aspectRatio,uy=a.y-b.y,vx=(c.x-b.x)*aspectRatio,vy=c.y-b.y;
    const lengths=Math.hypot(ux,uy)*Math.hypot(vx,vy);
    if (lengths < .0001) continue;
    const angle=Math.acos(Math.max(-1,Math.min(1,(ux*vx+uy*vy)/lengths)))*180/Math.PI;
    angles.push({angle,visibility,side});
  }
  const weight=angles.reduce((sum,a)=>sum+a.visibility,0);
  // A frontal floor view makes knee landmarks jump wildly whenever the torso or
  // clothes overlap the legs. Feet are the actual far support point we need, so
  // observe ankles/heels/toes directly and never use a knee angle as a form gate.
  const observeFoot=(ids)=>{
    const footPoints=ids.map(id=>points[id]).filter(p=>inSensor(p)&&Number.isFinite(p.visibility)&&p.visibility>=.04);
    if(!footPoints.length||Math.max(...footPoints.map(p=>p.visibility))<.06)return null;
    return {
      x:footPoints.reduce((sum,p)=>sum+p.x,0)/footPoints.length,
      footY:Math.max(...footPoints.map(p=>p.y)),
      score:footPoints.reduce((sum,p)=>sum+p.visibility,0),
    };
  };
  const feet=[observeFoot([27,29,31]),observeFoot([28,30,32])].filter(Boolean).sort((a,b)=>b.score-a.score);
  const foot=feet[0];
  const feetVisible=!!foot;
  const kneeAngles=[];
  for(const ids of [[23,25,27],[24,26,28]]){
    const hipPoint=points[ids[0]],kneePoint=points[ids[1]],anklePoint=points[ids[2]];
    if(!inSensor(hipPoint)||!inSensor(kneePoint)||!inSensor(anklePoint))continue;
    const visibility=Math.min(hipPoint.visibility,kneePoint.visibility,anklePoint.visibility);
    // Lower-body landmarks are often partly covered in the front camera. A low
    // per-frame threshold is safe here because the counter requires the bent
    // shape to persist over several frames before it blocks a repetition.
    if(!Number.isFinite(visibility)||visibility<.1)continue;
    const ux=(hipPoint.x-kneePoint.x)*aspectRatio,uy=hipPoint.y-kneePoint.y,uz=((hipPoint.z||0)-(kneePoint.z||0))*aspectRatio;
    const vx=(anklePoint.x-kneePoint.x)*aspectRatio,vy=anklePoint.y-kneePoint.y,vz=((anklePoint.z||0)-(kneePoint.z||0))*aspectRatio;
    const lengths=Math.hypot(ux,uy,uz)*Math.hypot(vx,vy,vz);
    if(lengths<.0001)continue;
    const angle=Math.acos(Math.max(-1,Math.min(1,(ux*vx+uy*vy+uz*vz)/lengths)))*180/Math.PI;
    kneeAngles.push({angle,visibility});
  }
  const knee=kneeAngles.sort((a,b)=>a.angle-b.angle)[0];
  // Deliberately leave the middle band unknown. It prevents perspective noise
  // from classifying a normal front-view plank as knee-supported.
  const kneeSupport=knee?knee.angle<=125?true:knee.angle>=155?false:undefined:undefined;
  const dist=(a,b)=>Math.hypot((a.x-b.x)*aspectRatio,a.y-b.y);
  const shoulderWidth=dist(left,right);
  const leftWrist=points[15],rightWrist=points[16];
  const handWidthRatio=shoulderWidth>.015&&inSensor(leftWrist)&&inSensor(rightWrist)&&Math.min(leftWrist.visibility,rightWrist.visibility)>=.45
    ?dist(leftWrist,rightWrist)/shoulderWidth:undefined;
  const midpoint=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
  const shoulder=midpoint(left,right);
  const leftHip=points[23],rightHip=points[24];
  const hip=inSensor(leftHip)&&inSensor(rightHip)&&Math.min(leftHip.visibility,rightHip.visibility)>=.35?midpoint(leftHip,rightHip):null;
  const anklePoints=[27,28,29,30,31,32].map(id=>points[id]).filter(p=>inSensor(p)&&Number.isFinite(p.visibility)&&p.visibility>=.08).sort((a,b)=>b.visibility-a.visibility);
  const ankle=anklePoints[0];
  const lineDeviation=(point,start,end)=>{
    const px=point.x*aspectRatio,sx=start.x*aspectRatio,ex=end.x*aspectRatio,dx=ex-sx,dy=end.y-start.y,len=Math.hypot(dx,dy);
    return len<.025?undefined:Math.abs(dy*px-dx*point.y+ex*start.y-end.y*sx)/(len*len);
  };
  const wristMid=inSensor(leftWrist)&&inSensor(rightWrist)&&Math.min(leftWrist.visibility,rightWrist.visibility)>=.45?midpoint(leftWrist,rightWrist):null;
  const leftElbowAngle=angles.find(a=>a.side==='left')?.angle;
  const rightElbowAngle=angles.find(a=>a.side==='right')?.angle;
  return {
    y:(left.y+right.y)/2,width:Math.abs(left.x-right.x),confidence,
    elbowAngle:weight ? angles.reduce((sum,a)=>sum+a.angle*a.visibility,0)/weight : undefined,
    leftElbowAngle,rightElbowAngle,
    elbowAsymmetry:Number.isFinite(leftElbowAngle)&&Number.isFinite(rightElbowAngle)?Math.abs(leftElbowAngle-rightElbowAngle):undefined,
    handWidthRatio,
    bodyLineDeviation:hip&&ankle?lineDeviation(hip,shoulder,ankle):undefined,
    shoulderToHandsRatio:wristMid&&shoulderWidth>.015?Math.abs(shoulder.y-wristMid.y)/shoulderWidth:undefined,
    armConfidence:angles.length ? Math.max(...angles.map(a=>a.visibility)) : 0,
    feetVisible,footY:foot?.footY,
    kneeAngle:knee?.angle,kneeConfidence:knee?.visibility,kneeSupport,
  };
}
`;
