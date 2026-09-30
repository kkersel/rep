import type { PvpOutcome, SessionKind, TechniqueSeverity, WorkoutSession, WorkoutTechniqueAssessment } from './data';

function migrateTechnique(value: any): WorkoutTechniqueAssessment | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const verdict = value.verdict === 'good' || value.verdict === 'needs_adjustment' || value.verdict === 'cannot_assess' ? value.verdict : null;
  const view = value.view === 'front' || value.view === 'side' || value.view === 'diagonal' || value.view === 'mixed' || value.view === 'unknown' ? value.view : 'unknown';
  if (!verdict || typeof value.summary !== 'string' || typeof value.assessedAt !== 'string') return undefined;
  const score = Number.isFinite(value.score) ? Math.max(1, Math.min(10, Number(value.score))) : null;
  const errors = Array.isArray(value.errors) ? value.errors.slice(0, 3).flatMap((item: any) => {
    if (!item || typeof item.code !== 'string' || typeof item.observation !== 'string' || typeof item.correction !== 'string') return [];
    const severity: TechniqueSeverity = item.severity === 'severe' || item.severity === 'moderate' ? item.severity : 'mild';
    return [{ code: item.code, observation: item.observation, correction: item.correction, severity }];
  }) : [];
  return {
    score, verdict, view, errors,
    summary: value.summary.slice(0, 4000),
    strengths: Array.isArray(value.strengths) ? value.strengths.filter((item: unknown): item is string => typeof item === 'string').slice(0, 3) : [],
    lessonIds: Array.isArray(value.lessonIds) ? value.lessonIds.filter((item: unknown): item is string => typeof item === 'string').slice(0, 3) : [],
    assessedAt: value.assessedAt,
  };
}

export function migrateSessionValue(value: any): WorkoutSession | null {
  if (!value || typeof value.id !== 'string' || typeof value.date !== 'string' || !Number.isFinite(value.reps) || !Number.isFinite(value.seconds)) return null;
  const mode: SessionKind = value.mode === 'streak' || value.mode === 'program' ? 'program' : value.mode === 'light' ? 'light' : value.mode === 'pvp' ? 'pvp' : 'free';
  const pvpResult: PvpOutcome | undefined = value.pvpResult === 'win' || value.pvpResult === 'loss' || value.pvpResult === 'draw' ? value.pvpResult : undefined;
  const programDay = Number.isInteger(value.programDay) ? value.programDay : undefined;
  const ratingDelta = Number.isFinite(value.ratingDelta) ? value.ratingDelta : value.eloDelta;
  const ratingAfter = Number.isFinite(value.ratingAfter) ? value.ratingAfter : value.eloAfter;
  return { id: value.id, date: value.date, reps: value.reps, seconds: value.seconds, goal: Number.isFinite(value.goal) ? value.goal : 0, mode, programDay, pvpResult, ratingDelta: Number.isFinite(ratingDelta) ? Math.round(ratingDelta) : undefined, ratingAfter: Number.isFinite(ratingAfter) ? Math.round(ratingAfter) : undefined, opponentNickname: typeof value.opponentNickname === 'string' ? value.opponentNickname : undefined, matchId: typeof value.matchId === 'string' ? value.matchId : undefined, technique: migrateTechnique(value.technique), synced: value.synced === true };
}

export function legacyBaselineFromValue(value: any) {
  return value && Number.isFinite(value.minimum) ? Math.max(1, Math.min(100, Math.round(value.minimum))) : null;
}
