import type { PvpOutcome, SessionKind, WorkoutSession } from './data';

export function migrateSessionValue(value: any): WorkoutSession | null {
  if (!value || typeof value.id !== 'string' || typeof value.date !== 'string' || !Number.isFinite(value.reps) || !Number.isFinite(value.seconds)) return null;
  const mode: SessionKind = value.mode === 'streak' ? 'program' : value.mode === 'pvp' ? 'pvp' : 'free';
  const pvpResult: PvpOutcome | undefined = value.pvpResult === 'win' || value.pvpResult === 'loss' || value.pvpResult === 'draw' ? value.pvpResult : undefined;
  return { id: value.id, date: value.date, reps: value.reps, seconds: value.seconds, goal: Number.isFinite(value.goal) ? value.goal : 0, mode, pvpResult, synced: false };
}

export function legacyBaselineFromValue(value: any) {
  return value && Number.isFinite(value.minimum) ? Math.max(1, Math.min(100, Math.round(value.minimum))) : null;
}
