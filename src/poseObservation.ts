// Shared plain JavaScript: embedded verbatim in WebView, exercised by tests.
export const observePoseSource = `function observePose(points, aspectRatio = 1) {
  if (!points || !points[11] || !points[12] || !Number.isFinite(aspectRatio) || aspectRatio <= 0) return null;
  const left = points[11], right = points[12];
  const inSensor = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y) && p.x > .005 && p.x < .995 && p.y > .005 && p.y < .995;
  if (!inSensor(left) || !inSensor(right)) return null;
  const confidence = Math.min(left.visibility, right.visibility);
  if (!Number.isFinite(confidence)) return null;
  const angles = [];
  for (const ids of [[11,13,15],[12,14,16]]) {
    const a=points[ids[0]],b=points[ids[1]],c=points[ids[2]];
    if (!inSensor(a) || !inSensor(b) || !inSensor(c)) continue;
    const visibility=Math.min(a.visibility,b.visibility,c.visibility);
    if (!Number.isFinite(visibility) || visibility < .55) continue;
    // Normalized x/y have different units: restore the image aspect ratio first.
    const ux=(a.x-b.x)*aspectRatio,uy=a.y-b.y,vx=(c.x-b.x)*aspectRatio,vy=c.y-b.y;
    const lengths=Math.hypot(ux,uy)*Math.hypot(vx,vy);
    if (lengths < .0001) continue;
    const angle=Math.acos(Math.max(-1,Math.min(1,(ux*vx+uy*vy)/lengths)))*180/Math.PI;
    angles.push({angle,visibility});
  }
  const weight=angles.reduce((sum,a)=>sum+a.visibility,0);
  // One complete leg is enough in a frontal view, where the second leg is often
  // hidden behind it. Keep the whole hip → knee → ankle chain and use the real
  // heel/toe landmarks when MediaPipe can see them.
  const observeLeg=(ids)=>{
    const hip=points[ids[0]],knee=points[ids[1]],ankle=points[ids[2]];
    if(!inSensor(hip)||!inSensor(knee)||!inSensor(ankle))return null;
    if(hip.visibility<.55||knee.visibility<.1||ankle.visibility<.06)return null;
    if(Math.hypot((hip.x-ankle.x)*aspectRatio,hip.y-ankle.y)<=.04)return null;
    const ux=(hip.x-knee.x)*aspectRatio,uy=hip.y-knee.y,vx=(ankle.x-knee.x)*aspectRatio,vy=ankle.y-knee.y;
    const lengths=Math.hypot(ux,uy)*Math.hypot(vx,vy);
    if(lengths<.0001)return null;
    const kneeAngle=Math.acos(Math.max(-1,Math.min(1,(ux*vx+uy*vy)/lengths)))*180/Math.PI;
    const footPoints=[ankle,points[ids[3]],points[ids[4]]].filter(p=>inSensor(p)&&p.visibility>=.04);
    const footY=Math.max(...footPoints.map(p=>p.y));
    return {footY,kneeY:knee.y,kneeAngle,legStraight:kneeAngle>=145,score:(knee.visibility||0)+(ankle.visibility||0)+footPoints.reduce((sum,p)=>sum+(p.visibility||0),0)};
  };
  const leg=[observeLeg([23,25,27,29,31]),observeLeg([24,26,28,30,32])].filter(Boolean).sort((a,b)=>b.score-a.score)[0];
  const legsVisible=!!leg;
  return {
    y:(left.y+right.y)/2,width:Math.abs(left.x-right.x),confidence,
    elbowAngle:weight ? angles.reduce((sum,a)=>sum+a.angle*a.visibility,0)/weight : undefined,
    armConfidence:angles.length ? Math.max(...angles.map(a=>a.visibility)) : 0,
    legsVisible,footY:leg?.footY,kneeY:leg?.kneeY,kneeAngle:leg?.kneeAngle,legStraight:leg?.legStraight,
  };
}
`;
