import type { WorkoutSession } from './data';
import { localDateKey, type Program } from './program';

export type ProgressEventType = 'main' | 'light' | 'personal_best' | 'weekly_goal' | 'free' | 'pvp_finish' | 'pvp_win' | 'pvp_draw';
export type ProgressEvent = { id: string; sourceId: string; type: ProgressEventType; points: number; date: string };
export type Achievement = { id: string; title: string; detail: string; current: number; target: number; unlockedAt?: string };

const mondayKey = (dateValue: string) => {
  const date = new Date(dateValue);
  const day = (date.getDay() + 6) % 7;
  return localDateKey(new Date(date.getFullYear(), date.getMonth(), date.getDate() - day, 12));
};

export function progressEvents(history: WorkoutSession[]): ProgressEvent[] {
  const sorted = [...history].sort((a, b) => +new Date(a.date) - +new Date(b.date));
  const events: ProgressEvent[] = [];
  const bestByMode = new Map<string, number>();
  const freeByDate = new Map<string, number>();
  const pvpByDate = new Map<string, number>();
  const mainByWeek = new Map<string, number>();
  const push = (source: WorkoutSession, type: ProgressEventType, points: number) =>
    events.push({ id: `${source.id}:${type}`, sourceId: source.id, type, points, date: source.date });
  for (const item of sorted) {
    if (item.mode === 'program' && item.reps >= item.goal) {
      push(item, 'main', 100);
      const week = mondayKey(item.date), count = (mainByWeek.get(week) ?? 0) + 1;
      mainByWeek.set(week, count);
      if (count === 3) push(item, 'weekly_goal', 100);
    }
    if (item.mode === 'light' && item.reps >= item.goal) push(item, 'light', 20);
    if (item.mode === 'free') {
      const date = localDateKey(item.date), count = freeByDate.get(date) ?? 0;
      if (count < 2) push(item, 'free', 5);
      freeByDate.set(date, count + 1);
    }
    if (item.mode === 'pvp') {
      const date = localDateKey(item.date), count = pvpByDate.get(date) ?? 0;
      if (count < 3) push(item, 'pvp_finish', 20);
      pvpByDate.set(date, count + 1);
      if (item.pvpResult === 'win') push(item, 'pvp_win', 10);
      if (item.pvpResult === 'draw') push(item, 'pvp_draw', 5);
    }
    const best = bestByMode.get(item.mode) ?? 0;
    if (item.reps > best && best > 0) push(item, 'personal_best', 20);
    bestByMode.set(item.mode, Math.max(best, item.reps));
  }
  return events;
}

export function levelForPoints(points: number) {
  let level = 1, spent = 0, needed = 100;
  while (points - spent >= needed) { spent += needed; level += 1; needed = 100 + (level - 1) * 20; }
  return { level, current: points - spent, needed, progress: needed ? (points - spent) / needed : 0 };
}

export function achievements(history: WorkoutSession[], program: Program | null): Achievement[] {
  const main = history.filter(item => item.mode === 'program' && item.reps >= item.goal);
  const wins = history.filter(item => item.mode === 'pvp' && item.pvpResult === 'win');
  const best = history.reduce((value, item) => Math.max(value, item.reps), 0);
  const twice = Math.max(2, (program?.baseline ?? 5) * 2);
  const values: [string, string, string, number, number, string | undefined][] = [
    ['first', 'Первый шаг', 'Заверши основную тренировку', main.length, 1, main[0]?.date],
    ['week', 'Ритм недели', 'Закрой 3 основные тренировки', Math.min(3, main.length), 3, main[2]?.date],
    ['ten', 'Десять подходов', 'Сохрани 10 тренировок', history.length, 10, history[9]?.date],
    ['growth', 'Рост', 'Сделай в 2 раза больше стартовой цели', best, twice, history.find(item => item.reps >= twice)?.date],
    ['duel', 'Первая победа', 'Выиграй PvP-матч', wins.length, 1, wins[0]?.date],
    ['five-wins', 'На серии', 'Выиграй 5 PvP-матчей', wins.length, 5, wins[4]?.date],
  ];
  return values.map(([id, title, detail, current, target, unlockedAt]) => ({ id, title, detail, current, target, unlockedAt: current >= target ? unlockedAt : undefined }));
}

export function gamificationSummary(history: WorkoutSession[], program: Program | null) {
  const events = progressEvents(history), points = events.reduce((sum, item) => sum + item.points, 0);
  return { events, points, ...levelForPoints(points), achievements: achievements(history, program) };
}
