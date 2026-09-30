import type { PvpOutcome, WorkoutSession } from './data';
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

// Kept for compatibility with the points-based progress journal and its tests.
export function levelForPoints(points: number) {
  let level = 1, spent = 0, needed = 100;
  while (points - spent >= needed) { spent += needed; level += 1; needed = 100 + (level - 1) * 20; }
  return { level, current: points - spent, needed, progress: needed ? (points - spent) / needed : 0 };
}

export const START_RATING = 1000;
export const MIN_RATING = 100;
export const RATING_LEVELS = [
  { level: 1, min: 100 },
  { level: 2, min: 600 },
  { level: 3, min: 900 },
  { level: 4, min: 1100 },
  { level: 5, min: 1250 },
  { level: 6, min: 1400 },
  { level: 7, min: 1550 },
  { level: 8, min: 1700 },
  { level: 9, min: 1850 },
  { level: 10, min: 2000 },
] as const;

export const LEVEL_COLORS = [
  '#8E8E93',
  '#1CE400', '#1CE400',
  '#FFC800', '#FFC800', '#FFC800', '#FFC800',
  '#FF6309', '#FF6309',
  '#FE1F00',
] as const;

export function levelColor(level: number) {
  return LEVEL_COLORS[Math.max(1, Math.min(10, Math.round(level))) - 1];
}

export function ratingDeltaForOutcome(outcome?: PvpOutcome) {
  return outcome === 'win' ? 25 : outcome === 'loss' ? -25 : 0;
}

export function levelForRating(value: number) {
  const rating = Math.max(MIN_RATING, Math.round(value));
  let index = 0;
  for (let i = 1; i < RATING_LEVELS.length; i += 1) if (rating >= RATING_LEVELS[i].min) index = i;
  const band = RATING_LEVELS[index], next = RATING_LEVELS[index + 1];
  const needed = next ? next.min - band.min : 0;
  const current = next ? rating - band.min : 0;
  return { rating, level: band.level, current, needed, progress: next ? Math.max(0, Math.min(1, current / needed)) : 1, nextLevelRating: next?.min ?? null };
}

export function ratingFromHistory(history: WorkoutSession[]) {
  let rating = START_RATING;
  const matches = history.filter(item => item.mode === 'pvp').sort((a, b) => +new Date(a.date) - +new Date(b.date));
  for (const match of matches) {
    const savedRating = Number.isFinite(match.ratingAfter) ? match.ratingAfter : match.eloAfter;
    const savedDelta = Number.isFinite(match.ratingDelta) ? match.ratingDelta : match.eloDelta;
    if (Number.isFinite(savedRating)) rating = Math.max(MIN_RATING, Math.round(savedRating!));
    else rating = Math.max(MIN_RATING, rating + (Number.isFinite(savedDelta) ? Math.round(savedDelta!) : ratingDeltaForOutcome(match.pvpResult)));
  }
  return levelForRating(rating);
}

// Compatibility aliases while screens and saved PvP sessions migrate to the rating names.
export const START_ELO = START_RATING;
export const MIN_ELO = MIN_RATING;
export const eloDeltaForOutcome = ratingDeltaForOutcome;
export const levelForElo = levelForRating;
export function eloFromHistory(history: WorkoutSession[]) {
  const result = ratingFromHistory(history);
  return { ...result, elo: result.rating, nextLevelElo: result.nextLevelRating };
}

export function achievements(history: WorkoutSession[], program: Program | null): Achievement[] {
  const sorted = [...history].sort((a, b) => +new Date(a.date) - +new Date(b.date));
  const main = sorted.filter(item => item.mode === 'program' && item.reps >= item.goal);
  const wins = sorted.filter(item => item.mode === 'pvp' && item.pvpResult === 'win');
  const pvp = sorted.filter(item => item.mode === 'pvp');
  const best = sorted.reduce((value, item) => Math.max(value, item.reps), 0);
  const totalReps = sorted.reduce((value, item) => value + item.reps, 0);
  const twice = Math.max(2, (program?.baseline ?? 5) * 2);
  const cumulativeDate = (target: number) => {
    let total = 0;
    return sorted.find(item => (total += item.reps) >= target)?.date;
  };
  const values: [string, string, string, number, number, string | undefined][] = [
    ['first', 'Первый шаг', 'Заверши основную тренировку', main.length, 1, main[0]?.date],
    ['week', 'Ритм недели', 'Закрой 3 основные тренировки', Math.min(3, main.length), 3, main[2]?.date],
    ['ten', 'Десять подходов', 'Сохрани 10 тренировок', sorted.length, 10, sorted[9]?.date],
    ['regular', 'В привычке', 'Заверши 25 тренировок', sorted.length, 25, sorted[24]?.date],
    ['growth', 'Рост', 'Сделай в 2 раза больше стартовой цели', best, twice, sorted.find(item => item.reps >= twice)?.date],
    ['discipline', 'Дисциплина', 'Закрой 10 основных тренировок', main.length, 10, main[9]?.date],
    ['century', 'Сотня', 'Сделай суммарно 100 повторений', totalReps, 100, cumulativeDate(100)],
    ['thousand', 'Тысяча', 'Сделай суммарно 1000 повторений', totalReps, 1000, cumulativeDate(1000)],
    ['duel', 'Первая победа', 'Выиграй PvP-матч', wins.length, 1, wins[0]?.date],
    ['five-wins', 'На серии', 'Выиграй 5 PvP-матчей', wins.length, 5, wins[4]?.date],
    ['ten-wins', 'Десять побед', 'Выиграй 10 PvP-матчей', wins.length, 10, wins[9]?.date],
    ['speed', 'Спринтер', 'Сделай 30 повторений за минуту', bestPvp(pvp), 30, pvp.find(item => item.reps >= 30)?.date],
  ];
  return values.map(([id, title, detail, current, target, unlockedAt]) => ({ id, title, detail, current, target, unlockedAt: current >= target ? unlockedAt : undefined }));
}

const bestPvp = (history: WorkoutSession[]) => history.reduce((value, item) => Math.max(value, item.reps), 0);

export function gamificationSummary(history: WorkoutSession[], program: Program | null) {
  const events = progressEvents(history), points = events.reduce((sum, item) => sum + item.points, 0);
  return { events, points, ...ratingFromHistory(history), achievements: achievements(history, program) };
}
