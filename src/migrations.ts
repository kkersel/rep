import type { PvpOutcome, SessionKind, WorkoutSession } from './data';

export function migrateSessionValue(value: any): WorkoutSession | null {
  if (!value || typeof value.id !== 'string' || typeof value.date !== 'string' || !Number.isFinite(value.reps) || !Number.isFinite(value.seconds)) return null;
  const mode: SessionKind = value.mode === 'streak' || value.mode === 'program' ? 'program' : value.mode === 'light' ? 'light' : value.mode === 'pvp' ? 'pvp' : 'free';
  const pvpResult: PvpOutcome | undefined = value.pvpResult === 'win' || value.pvpResult === 'loss' || value.pvpResult === 'draw' ? value.pvpResult : undefined;
  const programDay = Number.isInteger(value.programDay) ? value.programDay : undefined;
  return { id: value.id, date: value.date, reps: value.reps, seconds: value.seconds, goal: Number.isFinite(value.goal) ? value.goal : 0, mode, programDay, pvpResult, opponentNickname: typeof value.opponentNickname === 'string' ? value.opponentNickname : undefined, matchId: typeof value.matchId === 'string' ? value.matchId : undefined, synced: value.synced === true };
}

export function legacyBaselineFromValue(value: any) {
  return value && Number.isFinite(value.minimum) ? Math.max(1, Math.min(100, Math.round(value.minimum))) : null;
}
