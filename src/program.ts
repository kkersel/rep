export type ProgramDayKind = 'main' | 'light' | 'recovery';
export type ProgramDayStatus = 'upcoming' | 'completed' | 'failed' | 'skipped';

export type ProgramDay = {
  index: number;
  date: string;
  kind: ProgramDayKind;
  level: number;
  target: number;
  status: ProgramDayStatus;
  actualReps?: number;
  completedAt?: string;
};

export type Program = {
  id: string;
  baseline: number;
  step: number;
  startDate: string;
  status: 'active' | 'completed';
  workoutStreak: number;
  bestWorkoutStreak: number;
  confidentStreak: number;
  consecutiveMainFailures: number;
  days: ProgramDay[];
};

export type ProgramSummary = {
  baseline: number;
  control: number | null;
  best: number;
  completed: number;
  total: number;
  lightCompleted: number;
  adherence: number;
};

export const MAIN_DAYS = [1, 4, 6, 8, 11, 13, 15, 18, 20, 22, 25, 27, 29] as const;
export const LIGHT_DAYS = [2, 5, 9, 12, 16, 19, 23, 26, 30] as const;
export const RECOVERY_DAYS = [3, 7, 10, 14, 17, 21, 24, 28] as const;
export const MAIN_LEVELS = [0, 0, 1, 1, 2, 2, 3, 3, 2, 3, 3, 4, 4] as const;
export const TRAINING_DAYS = MAIN_DAYS;
export const TRAINING_LEVELS = MAIN_LEVELS;

export function localDateKey(value: Date | number | string = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addLocalDays(key: string, amount: number) {
  const [y, m, d] = key.split('-').map(Number);
  return localDateKey(new Date(y, m - 1, d + amount, 12));
}

export function createProgram(baseline: number, startDate = localDateKey()): Program {
  const safeBaseline = Math.max(1, Math.min(100, Math.round(baseline)));
  const step = Math.max(1, Math.round(safeBaseline * 0.1));
  let latestMainTarget = safeBaseline;
  const days: ProgramDay[] = Array.from({ length: 30 }, (_, offset) => {
    const index = offset + 1;
    const mainIndex = MAIN_DAYS.indexOf(index as (typeof MAIN_DAYS)[number]);
    const isLight = LIGHT_DAYS.includes(index as (typeof LIGHT_DAYS)[number]);
    const kind: ProgramDayKind = mainIndex >= 0 ? 'main' : isLight ? 'light' : 'recovery';
    if (mainIndex >= 0) latestMainTarget = safeBaseline + MAIN_LEVELS[mainIndex] * step;
    const target = kind === 'main' ? latestMainTarget : kind === 'light' ? Math.max(1, Math.round(latestMainTarget * .5)) : 0;
    return { index, date: addLocalDays(startDate, offset), kind, level: mainIndex >= 0 ? MAIN_LEVELS[mainIndex] : 0, target, status: 'upcoming' };
  });
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    baseline: safeBaseline,
    step,
    startDate,
    status: 'active',
    workoutStreak: 0,
    bestWorkoutStreak: 0,
    confidentStreak: 0,
    consecutiveMainFailures: 0,
    days,
  };
}

function clone(program: Program): Program {
  return { ...program, days: program.days.map(day => ({ ...day })) };
}

function nextMain(program: Program, afterIndex: number) {
  return program.days.find(day => day.index > afterIndex && day.kind === 'main' && day.status === 'upcoming');
}

function nextLight(program: Program, afterIndex: number) {
  return program.days.find(day => day.index > afterIndex && day.kind === 'light' && day.status === 'upcoming');
}

/** Upgrades old persisted programs without discarding recorded results. */
export function normalizeProgram(program: Program): Program {
  if (program.days.some(day => day.kind === 'light') && Number.isFinite(program.consecutiveMainFailures)) return program;
  const fresh = createProgram(program.baseline, program.startDate);
  const oldResults = new Map(program.days.filter(day => day.actualReps !== undefined).map(day => [day.date, day]));
  fresh.id = program.id;
  fresh.workoutStreak = program.workoutStreak ?? 0;
  fresh.bestWorkoutStreak = program.bestWorkoutStreak ?? 0;
  fresh.confidentStreak = program.confidentStreak ?? 0;
  fresh.consecutiveMainFailures = program.consecutiveMainFailures ?? 0;
  fresh.days = fresh.days.map(day => {
    const old = oldResults.get(day.date);
    return old ? { ...day, status: old.status, actualReps: old.actualReps, completedAt: old.completedAt } : day;
  });
  return fresh;
}

/** Marks elapsed sessions as missed while recovery and light days never break the main streak. */
export function reconcileProgram(program: Program, today = localDateKey()): Program {
  const next = clone(program);
  let missedTarget: number | null = null;
  let missedMain = false;
  for (const day of next.days) {
    if (day.date >= today || day.status !== 'upcoming' || day.kind === 'recovery') continue;
    day.status = 'skipped';
    if (day.kind === 'main') {
      missedTarget = day.target;
      missedMain = true;
      next.consecutiveMainFailures += 1;
    }
  }
  if (missedMain) {
    next.workoutStreak = 0;
    next.confidentStreak = 0;
    const upcoming = next.days.find(day => day.date >= today && day.kind === 'main' && day.status === 'upcoming');
    if (upcoming && missedTarget !== null) {
      upcoming.target = missedTarget;
      upcoming.level = Math.max(0, Math.round((missedTarget - next.baseline) / next.step));
    }
  }
  if (next.consecutiveMainFailures >= 2) {
    const light = next.days.find(day => day.date >= today && day.kind === 'light' && day.status === 'upcoming');
    if (light) { light.kind = 'recovery'; light.target = 0; }
    next.consecutiveMainFailures = 0;
  }
  const last = next.days[29];
  if (today > last.date || (today === last.date && last.status !== 'upcoming')) next.status = 'completed';
  return next;
}

export function recordProgramWorkout(program: Program, date: string, reps: number, completedAt = new Date().toISOString()): Program {
  const next = reconcileProgram(program, date);
  const day = next.days.find(item => item.date === date && (item.kind === 'main' || item.kind === 'light'));
  if (!day || day.status !== 'upcoming') return next;
  const actual = Math.max(0, Math.round(reps));
  const success = actual >= day.target;
  day.actualReps = actual;
  day.completedAt = completedAt;
  day.status = success ? 'completed' : 'failed';
  if (day.kind === 'light') return reconcileProgram(next, date);

  if (success) {
    next.workoutStreak += 1;
    next.bestWorkoutStreak = Math.max(next.bestWorkoutStreak, next.workoutStreak);
    next.consecutiveMainFailures = 0;
  } else {
    next.workoutStreak = 0;
    next.consecutiveMainFailures += 1;
  }

  const upcoming = nextMain(next, day.index);
  if (upcoming) {
    if (!success) {
      next.confidentStreak = 0;
      upcoming.target = actual >= day.target * .8 ? day.target : Math.max(next.baseline, day.target - next.step);
      upcoming.level = Math.max(0, Math.round((upcoming.target - next.baseline) / next.step));
    } else {
      const confident = actual >= day.target + next.step;
      next.confidentStreak = confident ? next.confidentStreak + 1 : 0;
      if (next.confidentStreak >= 2) {
        upcoming.target += next.step;
        upcoming.level += 1;
        next.confidentStreak = 0;
      }
    }
  }
  const light = nextLight(next, day.index);
  if (light && (!upcoming || light.index < upcoming.index)) light.target = Math.max(1, Math.round(day.target * .5));
  if (next.consecutiveMainFailures >= 2) {
    const recovery = nextLight(next, day.index);
    if (recovery) { recovery.kind = 'recovery'; recovery.target = 0; }
    next.consecutiveMainFailures = 0;
  }
  return reconcileProgram(next, date);
}

export function todayProgramDay(program: Program, today = localDateKey()) {
  return program.days.find(day => day.date === today) ?? null;
}

export function nextProgramTraining(program: Program, today = localDateKey()) {
  return program.days.find(day => day.date >= today && (day.kind === 'main' || day.kind === 'light') && day.status === 'upcoming') ?? null;
}

export function programDayNumber(program: Program, today = localDateKey()) {
  const ms = new Date(`${today}T12:00:00`).getTime() - new Date(`${program.startDate}T12:00:00`).getTime();
  return Math.min(30, Math.max(1, Math.floor(ms / 86400000) + 1));
}

export function programSummary(program: Program): ProgramSummary {
  const workouts = program.days.filter(day => day.kind === 'main');
  const finished = workouts.filter(day => day.status === 'completed');
  const control = program.days.find(day => day.index === 29)?.actualReps ?? null;
  const best = Math.max(0, ...workouts.map(day => day.actualReps ?? 0));
  return {
    baseline: program.baseline,
    control,
    best,
    completed: finished.length,
    total: workouts.length,
    lightCompleted: program.days.filter(day => day.kind === 'light' && day.status === 'completed').length,
    adherence: Math.round((finished.length / workouts.length) * 100),
  };
}

export function isProgram(value: unknown): value is Program {
  if (!value || typeof value !== 'object') return false;
  const p = value as Program;
  return Number.isFinite(p.baseline) && Number.isFinite(p.step) && typeof p.startDate === 'string' && Array.isArray(p.days) && p.days.length === 30;
}
