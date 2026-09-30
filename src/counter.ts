export type Observation = {
  y: number; width: number; confidence: number;
  elbowAngle?: number; armConfidence?: number;
  leftElbowAngle?: number; rightElbowAngle?: number; elbowAsymmetry?: number;
  handWidthRatio?: number; bodyLineDeviation?: number; shoulderToHandsRatio?: number;
  feetVisible?: boolean;
  footY?: number;
  kneeAngle?: number;
  kneeConfidence?: number;
  kneeSupport?: boolean;
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
  needsFullPlank = false;
  private smoothed: number | null = null;
  private candidate = '';
  private candidateFrames = 0;
  private since = 0;
  private lastSeen: number | null = null;
  private topShoulderY: number | null = null;
  private bottomShoulderY: number | null = null;
  private supportFootY: number | null = null;
  private cycleFeetSeen = false;
  private lastLegSeenAt = -Infinity;
  private bottomReachedSupport = false;
  private bottomTravel = 0;
  private typicalTravel: number | null = null;
  private seekMinShoulderY: number | null = null;
  private lastTopAt = -Infinity;
  private downAt = 0;
  private lastRep = -Infinity;
  private bentKneeFrames = 0;
  private bentKneeSince = 0;
  private straightKneeFrames = 0;
  private straightKneeSince = 0;
  private kneelingDetected = false;

  resetTracking() {
    this.phase = 'seek-top'; this.smoothed = null; this.candidate = '';
    this.candidateFrames = 0; this.lastSeen = null; this.topShoulderY = null;
    this.bottomShoulderY = null;
    this.progress = 0; this.tracking = false; this.needsBodyMovement = false;
    this.needsFeet = true;
    this.supportFootY = null;
    this.cycleFeetSeen = false;
    this.lastLegSeenAt = -Infinity; this.bottomReachedSupport = false;
    this.bottomTravel = 0; this.typicalTravel = null;
    this.seekMinShoulderY = null;
    this.lastTopAt = -Infinity;
    this.bentKneeFrames = 0; this.bentKneeSince = 0;
    this.straightKneeFrames = 0; this.straightKneeSince = 0;
  }
  private updateKneeGuard(o: Observation, time: number) {
    if (o.kneeSupport === true) {
      if (!this.bentKneeFrames) this.bentKneeSince = time;
      this.bentKneeFrames++;
      this.straightKneeFrames = 0; this.straightKneeSince = 0;
      // A single bad knee landmark is common in a front view. Require a stable
      // bent-leg shape across multiple frames before blocking the set.
      if (this.bentKneeFrames >= 3 && time - this.bentKneeSince >= 120) {
        this.kneelingDetected = true;
      }
    } else if (o.kneeSupport === false) {
      if (!this.straightKneeFrames) this.straightKneeSince = time;
      this.straightKneeFrames++;
      this.bentKneeFrames = 0; this.bentKneeSince = 0;
      // Once knee support has been seen, do not clear the guard merely because
      // clothing hides the legs. Clear it only after a sustained straight-leg
      // plank, so the user can switch to normal push-ups without restarting.
      if (this.straightKneeFrames >= 5 && time - this.straightKneeSince >= 300) {
        this.kneelingDetected = false;
      }
    } else {
      this.bentKneeFrames = 0; this.bentKneeSince = 0;
      this.straightKneeFrames = 0; this.straightKneeSince = 0;
    }
    this.needsFullPlank = this.kneelingDetected;
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
    this.updateKneeGuard(o!, time);
    if(this.phase==='seek-top') {
      this.seekMinShoulderY=this.seekMinShoulderY===null
        ?o!.y
        :Math.min(this.seekMinShoulderY,o!.y);
    }
    const footMeasured=o!.feetVisible===true&&Number.isFinite(o!.footY);
    if (footMeasured) {
      this.cycleFeetSeen=true; this.lastLegSeenAt=time;
      // Initialize once here. The active top-position branch below is the only
      // place allowed to move the support line; it stays frozen during descent.
      if (this.supportFootY===null) this.supportFootY=o!.footY!;
      this.needsFeet=false;
    }
    this.smoothed = this.smoothed === null ? angle! : this.smoothed * .35 + angle! * .65;
    this.progress = Math.max(0, Math.min(1, (152 - this.smoothed) / 32));
    // In a front view the forearms can overlap the torso near the floor, which makes
    // MediaPipe overestimate deep elbow flexion. Shoulder travel remains the form gate.
    let zone = this.smoothed >= 152 && angle! >= 152 ? 'top' : this.smoothed <= 138 ? 'bottom' : 'middle';
    const topSupportGap=this.supportFootY===null||this.topShoulderY===null
      ?0
      :Math.max(0,this.supportFootY-this.topShoulderY);
    const targetGap=Math.min(.18,Math.max(.12,topSupportGap*.45));
    const footGap=this.supportFootY===null?Infinity:this.supportFootY-o!.y;
    const legFresh=time-this.lastLegSeenAt<=1500;
    const reachesSupport=legFresh&&footGap<=targetGap;
    const travelFromTop=o!.y-(this.topShoulderY??o!.y);
    const requiredTravel=Math.max(.04,(this.typicalTravel??0)*.45);
    // On a low-FPS device a fast repetition may expose only one deeply flexed
    // frame. Accept it when three independent signals agree: strong arm
    // flexion, full-body shoulder travel, and arrival at the frozen foot line.
    // The short elapsed-time guard rejects a one-frame jump straight after a
    // stable top pose without making the decision depend on camera frame rate.
    const clearBottomDescent=this.phase==='top'&&angle!<=125&&
      time-this.lastTopAt>=120&&travelFromTop>=requiredTravel&&reachesSupport;
    const seekFootGap=footMeasured?o!.footY!-o!.y:Infinity;
    const seekDescent=o!.y-(this.seekMinShoulderY??o!.y);
    const clearBottomEntry=this.phase==='seek-top'&&footMeasured&&angle!<=125&&
      seekFootGap<=.12&&seekDescent>=.04;
    // Front-facing wrists and shoulders often overlap near lockout and the
    // estimated elbow angle can stop around 150–154°. A large shoulder return
    // from a verified bottom is stronger evidence than demanding a perfect
    // 155° landmark estimate from every camera and body type.
    const clearTopReturn=this.phase==='bottom'&&angle!>=150&&
      this.bottomShoulderY!==null&&this.bottomShoulderY-o!.y>=.055&&time-this.downAt>=120;
    if(clearBottomDescent||clearBottomEntry)zone='bottom';
    if(clearTopReturn)zone='top';
    if (zone !== this.candidate) { this.candidate = zone; this.since = time; this.candidateFrames = 1; }
    else this.candidateFrames++;
    // Fast sets and low-FPS devices can expose only one fully extended frame at
    // the top. A confirmed bottom plus clear shoulder lift makes that single
    // frame safe to accept, while flexion still needs two frames and therefore
    // cannot be triggered by a pose-estimation spike.
    if (!clearTopReturn&&!clearBottomDescent&&!clearBottomEntry&&
      (this.candidateFrames < 2 || time - this.since < 70)) return false;
    if (this.phase === 'seek-top' && zone === 'bottom' && footMeasured) {
      // The pose model often becomes ready while the user is already descending.
      // Accept a clearly flexed, foot-supported bottom as the start of the first
      // cycle. The following extension still has to lift the shoulders, so a
      // static crouch or an arm bend without body motion cannot create a rep.
      if (seekFootGap<=.12&&seekDescent>=.04) {
        this.phase='bottom';
        this.supportFootY=o!.footY!;
        this.bottomShoulderY=o!.y;
        this.bottomReachedSupport=true;
        this.bottomTravel=0;
        this.cycleFeetSeen=true;
        this.lastLegSeenAt=time;
        this.downAt=time;
        this.needsFeet=false;
      }
    } else if (this.phase === 'seek-top' && zone === 'top') {
      this.needsFeet = !footMeasured;
      this.cycleFeetSeen = footMeasured;
      this.lastLegSeenAt = footMeasured ? time : -Infinity;
      this.supportFootY = footMeasured ? o!.footY! : null;
      this.phase = 'top'; this.topShoulderY = o!.y;
      this.lastTopAt=time;
      this.bottomReachedSupport=false;
    } else if (this.phase === 'top' && zone === 'top') {
      if (footMeasured) {
        this.topShoulderY=o!.y;
        // The user may open the camera while standing, then get into a plank
        // without ever leaving the frame. Reacquire both baselines while the
        // arms are straight so a standing foot line cannot poison the set.
        this.supportFootY=o!.footY!;
      }
      this.lastTopAt=time;
      this.needsBodyMovement = false;
      this.needsFeet = !this.cycleFeetSeen;
    } else if (this.phase === 'top' && zone === 'bottom') {
      // At the accepted bottom the shoulders must be close to the frozen foot
      // support line. A knee-supported rep normally bottoms out at the nearer
      // knee line instead, while an honest full-body rep reaches the feet line.
      // Perspective changes how far the foot line sits below the shoulders.
      // Derive the bottom tolerance from that person's visible top position;
      // the cap still rejects shallow, knee-supported body drops.
      this.needsFeet=!legFresh;
      // Once a few repetitions have established the user's/camera's range,
      // reject small pose-estimation rebounds near the top. This remains scale
      // independent because it learns from the current set instead of using a
      // video-specific pixel threshold.
      this.needsBodyMovement=travelFromTop<requiredTravel||!reachesSupport;
      if (!this.needsBodyMovement&&!this.needsFeet) {
        this.phase='bottom'; this.bottomShoulderY=o!.y; this.bottomReachedSupport=true;
        this.bottomTravel=travelFromTop; this.downAt=time;
      }
    }
    else if (this.phase === 'bottom' && zone !== 'top') {
      this.bottomShoulderY = Math.max(this.bottomShoulderY ?? o!.y, o!.y);
    }
    else if (this.phase === 'bottom' && zone === 'top') {
      if (this.bottomShoulderY !== null && this.bottomShoulderY - o!.y < .04) return false;
      this.needsBodyMovement = false;
      // A completed bottom → top transition is already protected by angle,
      // shoulder travel, feet and the phase machine. Keep only a small temporal
      // guard so fast athletes and slower cameras do not lose a valid endpoint.
      if (time - this.downAt < 120 || time - this.lastRep < 350) return false;
      const missingFootSupport=!this.cycleFeetSeen||!this.bottomReachedSupport||time-this.lastLegSeenAt>1500;
      if (missingFootSupport || this.kneelingDetected) {
        this.phase = 'top'; this.topShoulderY = o!.y; this.needsFeet = missingFootSupport;
        this.bottomReachedSupport=false;
        return false;
      }
      this.count++; this.lastRep = time;
      if(this.bottomTravel>0) {
        this.typicalTravel=this.typicalTravel===null
          ?this.bottomTravel
          :this.typicalTravel*.7+this.bottomTravel*.3;
      }
      this.phase = 'top'; this.topShoulderY = o!.y;
      this.lastTopAt=time;
      this.bottomShoulderY = null;
      this.cycleFeetSeen = footMeasured;
      this.supportFootY = footMeasured ? o!.footY! : null;
      this.lastLegSeenAt = footMeasured ? time : -Infinity;
      this.bottomReachedSupport=false;
      this.bottomTravel=0;
      this.needsFeet = !this.cycleFeetSeen;
      return true;
    }
    return false;
  }
}
