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
  // One complete leg is enough in a frontal view, where the other leg is often
  // hidden directly behind it. Requiring hip → knee → ankle keeps this a
  // full-body signal rather than trusting a stray ankle landmark.
  const legVisible=(ids)=>{
    const hip=points[ids[0]],knee=points[ids[1]],ankle=points[ids[2]];
    if(!inSensor(hip)||!inSensor(knee)||!inSensor(ankle))return false;
    if(hip.visibility<.55||knee.visibility<.1||ankle.visibility<.06)return false;
    return Math.hypot((hip.x-ankle.x)*aspectRatio,hip.y-ankle.y)>.04;
  };
  const legsVisible=legVisible([23,25,27])||legVisible([24,26,28]);
  return {
    y:(left.y+right.y)/2,width:Math.abs(left.x-right.x),confidence,
    elbowAngle:weight ? angles.reduce((sum,a)=>sum+a.angle*a.visibility,0)/weight : undefined,
    armConfidence:angles.length ? Math.max(...angles.map(a=>a.visibility)) : 0,
    legsVisible,
  };
}
`;
