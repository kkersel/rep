export type Observation = {
  y: number; width: number; confidence: number;
  elbowAngle?: number; armConfidence?: number;
  legsVisible?: boolean;
  footY?: number; kneeY?: number; kneeAngle?: number; legStraight?: boolean;
};
export type Phase = 'seek-top' | 'top' | 'bottom';

/** Counts elbow extension → flexion → extension, independently of camera height. */
export class RepCounter {
  phase: Phase = 'seek-top';
  count = 0;
  progress = 0;
  tracking = false;
  needsBodyMovement = false;
  needsFeet = true;
  private smoothed: number | null = null;
  private candidate = '';
  private candidateFrames = 0;
  private since = 0;
  private lastSeen: number | null = null;
  private topShoulderY: number | null = null;
  private bottomShoulderY: number | null = null;
  private supportFootY: number | null = null;
  private cycleLegsSeen = false;
  private cycleStraightLegSeen = false;
  private lastLegSeenAt = -Infinity;
  private lastStraightLegSeenAt = -Infinity;
  private bottomReachedSupport = false;
  private downAt = 0;
  private lastRep = -Infinity;

  resetTracking() {
    this.phase = 'seek-top'; this.smoothed = null; this.candidate = '';
    this.candidateFrames = 0; this.lastSeen = null; this.topShoulderY = null;
    this.bottomShoulderY = null;
    this.progress = 0; this.tracking = false; this.needsBodyMovement = false;
    this.needsFeet = true;
    this.supportFootY = null;
    this.cycleLegsSeen = false;
    this.cycleStraightLegSeen = false; this.lastLegSeenAt = -Infinity;
    this.lastStraightLegSeenAt = -Infinity; this.bottomReachedSupport = false;
  }
  update(o: Observation | null, time: number): boolean {
    const angle = o?.elbowAngle;
    const valid = o && Number.isFinite(angle) && angle! >= 0 && angle! <= 180 &&
      Number.isFinite(o.armConfidence) && o.armConfidence! >= .55 &&
      Number.isFinite(o.confidence) && o.confidence >= .55;
    if (!valid) {
      this.tracking = false; this.candidate = ''; this.candidateFrames = 0;
      if (this.lastSeen !== null && time - this.lastSeen > 750) this.resetTracking();
      return false;
    }
    if (this.lastSeen !== null && time - this.lastSeen > 750) this.resetTracking();
    this.lastSeen = time; this.tracking = true;
    const legMeasured=o!.legsVisible===true&&Number.isFinite(o!.footY)&&Number.isFinite(o!.kneeAngle);
    if (legMeasured) {
      this.cycleLegsSeen=true; this.lastLegSeenAt=time;
      this.supportFootY=this.supportFootY===null?o!.footY!:Math.max(this.supportFootY,o!.footY!);
      if(o!.legStraight===true){this.cycleStraightLegSeen=true;this.lastStraightLegSeenAt=time}
      this.needsFeet=o!.legStraight!==true;
    }
    this.smoothed = this.smoothed === null ? angle! : this.smoothed * .35 + angle! * .65;
    this.progress = Math.max(0, Math.min(1, (152 - this.smoothed) / 32));
    // In a front view the forearms can overlap the torso near the floor, which makes
    // MediaPipe overestimate deep elbow flexion. Shoulder travel remains the form gate.
    const zone = this.smoothed >= 152 && angle! >= 152 ? 'top' : this.smoothed <= 138 ? 'bottom' : 'middle';
    if (zone !== this.candidate) { this.candidate = zone; this.since = time; this.candidateFrames = 1; }
    else this.candidateFrames++;
    if (this.candidateFrames < 2 || time - this.since < 70) return false;
    if (this.phase === 'seek-top' && zone === 'top') {
      this.needsFeet = !legMeasured || o!.legStraight !== true;
      this.cycleLegsSeen = legMeasured;
      this.cycleStraightLegSeen = legMeasured && o!.legStraight === true;
      this.lastLegSeenAt = legMeasured ? time : -Infinity;
      this.lastStraightLegSeenAt = this.cycleStraightLegSeen ? time : -Infinity;
      this.supportFootY = legMeasured ? o!.footY! : null;
      this.phase = 'top'; this.topShoulderY = o!.y;
      this.bottomReachedSupport=false;
    } else if (this.phase === 'top' && zone === 'top') {
      if (legMeasured) {
        this.topShoulderY=o!.y;
      }
      this.needsBodyMovement = false;
      this.needsFeet = !this.cycleLegsSeen || !this.cycleStraightLegSeen;
    } else if (this.phase === 'top' && zone === 'bottom') {
      const travel = o!.y - (this.topShoulderY ?? o!.y);
      const legFresh=time-this.lastLegSeenAt<=1500;
      const straightLeg=legMeasured?o!.legStraight===true:time-this.lastStraightLegSeenAt<=1500;
      const footGap=this.supportFootY===null?Infinity:this.supportFootY-o!.y;
      // At the accepted bottom the shoulders must be close to the foot support
      // line in the camera image. This rejects shallow arm bends and desk poses.
      const targetGap=.12;
      const reachesSupport=legFresh&&straightLeg&&footGap<=targetGap;
      this.needsFeet=!legFresh||!straightLeg;
      this.needsBodyMovement=travel<.04||!reachesSupport;
      if (!this.needsBodyMovement&&!this.needsFeet) {
        this.phase='bottom'; this.bottomShoulderY=o!.y; this.bottomReachedSupport=true; this.downAt=time;
      }
    }
    else if (this.phase === 'bottom' && zone !== 'top') {
      this.bottomShoulderY = Math.max(this.bottomShoulderY ?? o!.y, o!.y);
    }
    else if (this.phase === 'bottom' && zone === 'top') {
      if (this.bottomShoulderY !== null && this.bottomShoulderY - o!.y < .04) return false;
      this.needsBodyMovement = false;
      if (time - this.downAt < 200 || time - this.lastRep < 500) return false;
      if (!this.cycleLegsSeen || !this.cycleStraightLegSeen || !this.bottomReachedSupport || time-this.lastLegSeenAt>1500) {
        this.phase = 'top'; this.topShoulderY = o!.y; this.needsFeet = true;
        this.bottomReachedSupport=false;
        return false;
      }
      this.count++; this.lastRep = time;
      this.phase = 'top'; this.topShoulderY = o!.y;
      this.bottomShoulderY = null;
      this.cycleLegsSeen = legMeasured;
      this.cycleStraightLegSeen = legMeasured && o!.legStraight === true;
      this.supportFootY = legMeasured ? o!.footY! : null;
      this.lastLegSeenAt = legMeasured ? time : -Infinity;
      this.lastStraightLegSeenAt = this.cycleStraightLegSeen ? time : -Infinity;
      this.bottomReachedSupport=false;
      this.needsFeet = !this.cycleStraightLegSeen;
      return true;
    }
    return false;
  }
}
