import { RepCounter, type Observation } from './counter';
/** No calibration or stillness. The first reliable arm observation enables counting. */
export class AutomaticCounter {
  counter: RepCounter | null = null;
  reset() { this.counter = null; }
  update(value: Observation | null, time: number) {
    if (this.counter) return { started: false, rep: this.counter.update(value, time) };
    if (!value || !Number.isFinite(value.elbowAngle) || !Number.isFinite(value.armConfidence) || value.armConfidence! < .55 || !Number.isFinite(value.confidence) || value.confidence < .55) return { started: false, rep: false };
    this.counter = new RepCounter();
    this.counter.update(value, time);
    return { started: true, rep: false };
  }
}
