import type { WorkoutSession } from './data';
import { localDateKey } from './program';

export type StatsPeriod = '7d' | '30d' | 'all';
export function filteredHistory(history: WorkoutSession[], period: StatsPeriod, now = new Date()) {
  if (period === 'all') return history;
  const days = period === '7d' ? 7 : 30;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days + 1).getTime();
  return history.filter(item => +new Date(item.date) >= start);
}
export function sessionStats(history: WorkoutSession[]) {
  const pvp = history.filter(item => item.mode === 'pvp');
  return {
    reps: history.reduce((sum, item) => sum + item.reps, 0),
    sessions: history.length,
    seconds: history.reduce((sum, item) => sum + item.seconds, 0),
    best: history.reduce((best, item) => Math.max(best, item.reps), 0),
    main: history.filter(item => item.mode === 'program').length,
    light: history.filter(item => item.mode === 'light').length,
    free: history.filter(item => item.mode === 'free').length,
    pvp: pvp.length,
    wins: pvp.filter(item => item.pvpResult === 'win').length,
    losses: pvp.filter(item => item.pvpResult === 'loss').length,
    draws: pvp.filter(item => item.pvpResult === 'draw').length,
    best60: pvp.reduce((best, item) => Math.max(best, item.reps), 0),
  };
}
export function dailyReps(history: WorkoutSession[], days: number, now = new Date()) {
  return Array.from({ length: days }, (_, offset) => {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days + 1 + offset, 12);
    const key = localDateKey(date);
    return {
      date: key,
      label: date.toLocaleDateString('ru-RU', { weekday: 'short' }).slice(0, 2),
      reps: history.filter(item => localDateKey(item.date) === key).reduce((sum, item) => sum + item.reps, 0),
      main: history.filter(item => localDateKey(item.date) === key && item.mode === 'program').reduce((sum, item) => sum + item.reps, 0),
      light: history.filter(item => localDateKey(item.date) === key && item.mode === 'light').reduce((sum, item) => sum + item.reps, 0),
    };
  });
}
