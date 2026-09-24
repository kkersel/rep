import { observePoseSource } from '../src/poseObservation.ts';
export const observePose = new Function(`return (${observePoseSource})`)();
// Manually transcribed green joint centers from the user's two screenshots.
// Screenshot coordinates work here because padding is a translation; angles are invariant.
export function screenshotPose(bottom=false) {
  const p=Array.from({length:33},()=>({x:.5,y:.5,visibility:0}));
  const coords=bottom?[[178,800],[405,797],[108,825],[509,783],[123,919],[462,911]]:[[200,610],[390,615],[163,755],[434,760],[126,915],[462,911]];
  [11,12,13,14,15,16].forEach((id,i)=>{p[id]={x:coords[i][0]/597,y:coords[i][1]/1280,visibility:.99};});
  // The hips/knees are partly covered in the photos; these points follow the
  // visible torso into the two shoes at the back of the frame.
  const legs=bottom?[[250,840],[347,838],[273,867],[324,865],[287,891],[310,889]]:[[246,735],[350,737],[270,810],[327,811],[286,887],[312,887]];
  [23,24,25,26,27,28].forEach((id,i)=>{p[id]={x:legs[i][0]/597,y:legs[i][1]/1280,visibility:.9};});
  return p;
}
export const top=()=>observePose(screenshotPose(),597/1280);
export const bottom=()=>observePose(screenshotPose(true),597/1280);
