export type Observation = {
  y: number; width: number; confidence: number;
  elbowAngle?: number; armConfidence?: number;
  legsVisible?: boolean;
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
  private cycleLegsSeen = false;
  private downAt = 0;
  private lastRep = -Infinity;
  private pendingLegConfirmationUntil = 0;

  resetTracking() {
    this.phase = 'seek-top'; this.smoothed = null; this.candidate = '';
    this.candidateFrames = 0; this.lastSeen = null; this.topShoulderY = null;
    this.bottomShoulderY = null;
    this.progress = 0; this.tracking = false; this.needsBodyMovement = false;
    this.needsFeet = true;
    this.cycleLegsSeen = false;
    this.pendingLegConfirmationUntil = 0;
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
    if (this.pendingLegConfirmationUntil && time > this.pendingLegConfirmationUntil) this.pendingLegConfirmationUntil = 0;
    if (o!.legsVisible && this.pendingLegConfirmationUntil >= time && time - this.lastRep >= 500) {
      this.count++; this.lastRep = time; this.pendingLegConfirmationUntil = 0;
      this.cycleLegsSeen = true; this.needsFeet = false;
      return true;
    }
    if (o!.legsVisible) { this.cycleLegsSeen = true; this.needsFeet = false; }
    this.smoothed = this.smoothed === null ? angle! : this.smoothed * .35 + angle! * .65;
    this.progress = Math.max(0, Math.min(1, (152 - this.smoothed) / 32));
    // In a front view the forearms can overlap the torso near the floor, which makes
    // MediaPipe overestimate deep elbow flexion. Shoulder travel remains the form gate.
    const zone = this.smoothed >= 152 && angle! >= 152 ? 'top' : this.smoothed <= 138 ? 'bottom' : 'middle';
    if (zone !== this.candidate) { this.candidate = zone; this.since = time; this.candidateFrames = 1; }
    else this.candidateFrames++;
    if (this.candidateFrames < 2 || time - this.since < 70) return false;
    if (this.phase === 'seek-top' && zone === 'top') {
      this.needsFeet = o!.legsVisible !== true;
      this.cycleLegsSeen = o!.legsVisible === true;
      this.phase = 'top'; this.topShoulderY = o!.y;
    } else if (this.phase === 'top' && zone === 'top') {
      if (o!.legsVisible) this.topShoulderY = o!.y;
      this.needsBodyMovement = false; this.needsFeet = !this.cycleLegsSeen;
    } else if (this.phase === 'top' && zone === 'bottom') {
      const travel = o!.y - (this.topShoulderY ?? o!.y);
      this.needsBodyMovement = travel < .04;
      if (!this.needsBodyMovement) { this.phase = 'bottom'; this.bottomShoulderY = o!.y; this.downAt = time; }
    }
    else if (this.phase === 'bottom' && zone !== 'top') {
      this.bottomShoulderY = Math.max(this.bottomShoulderY ?? o!.y, o!.y);
    }
    else if (this.phase === 'bottom' && zone === 'top') {
      if (this.bottomShoulderY !== null && this.bottomShoulderY - o!.y < .04) return false;
      this.needsBodyMovement = false;
      if (time - this.downAt < 200 || time - this.lastRep < 500) return false;
      if (!this.cycleLegsSeen) {
        this.phase = 'top'; this.topShoulderY = o!.y; this.needsFeet = true;
        this.pendingLegConfirmationUntil = time + 800;
        return false;
      }
      this.count++; this.lastRep = time;
      this.phase = 'top'; this.topShoulderY = o!.y;
      this.bottomShoulderY = null;
      this.cycleLegsSeen = o!.legsVisible === true;
      this.needsFeet = !this.cycleLegsSeen;
      return true;
    }
    return false;
  }
}
