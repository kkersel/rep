import type { WorkoutSession } from './data';

export const techniqueIssueLabels: Record<string, string> = {
  hips_sag: 'Положение таза',
  hips_high: 'Положение таза',
  elbows_flared: 'Траектория локтей',
  hands_too_wide: 'Постановка рук',
  shallow_depth: 'Глубина отжимания',
  head_forward: 'Положение головы',
  body_not_rigid: 'Линия корпуса',
  asymmetry: 'Симметрия движения',
  unstable_tempo: 'Контроль темпа',
  hand_position: 'Положение кистей',
  other: 'Техника движения',
};

export function techniqueStats(history: WorkoutSession[]) {
  const assessed = history
    .filter(item => item.mode !== 'pvp' && item.technique)
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  const scored = assessed.filter(item => typeof item.technique?.score === 'number');
  const average = (items: WorkoutSession[]) => items.length
    ? items.reduce((sum, item) => sum + (item.technique?.score ?? 0), 0) / items.length
    : null;
  const current = average(scored.slice(0, 5));
  const recent = average(scored.slice(0, 3));
  const previous = average(scored.slice(3, 6));
  const issues = new Map<string, { code: string; label: string; count: number; correction: string; observation: string }>();
  for (const session of assessed) for (const issue of session.technique?.errors ?? []) {
    const item = issues.get(issue.code);
    issues.set(issue.code, {
      code: issue.code,
      label: techniqueIssueLabels[issue.code] ?? 'Техника движения',
      count: (item?.count ?? 0) + 1,
      correction: item?.correction ?? issue.correction,
      observation: item?.observation ?? issue.observation,
    });
  }
  return {
    assessed: assessed.length,
    score: current === null ? null : Math.round(current * 10) / 10,
    best: scored.length ? Math.max(...scored.map(item => item.technique!.score!)) : null,
    trend: recent === null || previous === null ? 0 : Math.round((recent - previous) * 10) / 10,
    strengths: assessed[0]?.technique?.strengths.slice(0, 2) ?? [],
    issues: [...issues.values()].sort((a, b) => b.count - a.count).slice(0, 3),
    recentScores: scored.slice(0, 7).reverse().map(item => ({ date: item.date, score: item.technique!.score! })),
    latest: assessed[0]?.technique ?? null,
  };
}
