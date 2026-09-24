export type ProgramDayKind = 'training' | 'recovery' | 'summary';
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
  days: ProgramDay[];
};

export type ProgramSummary = {
  baseline: number;
  control: number | null;
  best: number;
  completed: number;
  total: number;
  adherence: number;
};

export const TRAINING_DAYS = [1, 3, 5, 8, 10, 12, 15, 17, 19, 22, 24, 26, 29] as const;
export const TRAINING_LEVELS = [0, 0, 1, 1, 2, 2, 3, 3, 2, 3, 3, 4, 4] as const;

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
  let workoutIndex = 0;
  const days: ProgramDay[] = Array.from({ length: 30 }, (_, offset) => {
    const index = offset + 1;
    const trainingIndex = TRAINING_DAYS.indexOf(index as (typeof TRAINING_DAYS)[number]);
    const kind: ProgramDayKind = index === 30 ? 'summary' : trainingIndex >= 0 ? 'training' : 'recovery';
    const level = trainingIndex >= 0 ? TRAINING_LEVELS[workoutIndex++] : 0;
    return {
      index,
      date: addLocalDays(startDate, offset),
      kind,
      level,
      target: kind === 'training' ? safeBaseline + level * step : 0,
      status: 'upcoming',
    };
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
    days,
  };
}

function clone(program: Program): Program {
  return { ...program, days: program.days.map(day => ({ ...day })) };
}

function nextTraining(program: Program, afterIndex: number) {
  return program.days.find(day => day.index > afterIndex && day.kind === 'training' && day.status === 'upcoming');
}

/** Marks elapsed workouts as skipped and carries the last missed target forward. */
export function reconcileProgram(program: Program, today = localDateKey()): Program {
  const next = clone(program);
  let missedTarget: number | null = null;
  let skipped = false;
  for (const day of next.days) {
    if (day.date >= today || day.kind !== 'training' || day.status !== 'upcoming') continue;
    day.status = 'skipped';
    missedTarget = day.target;
    skipped = true;
  }
  if (skipped) {
    next.workoutStreak = 0;
    next.confidentStreak = 0;
    const upcoming = next.days.find(day => day.date >= today && day.kind === 'training' && day.status === 'upcoming');
    if (upcoming && missedTarget !== null) {
      upcoming.target = missedTarget;
      upcoming.level = Math.max(0, Math.round((missedTarget - next.baseline) / next.step));
    }
  }
  if (today >= next.days[29].date) next.status = 'completed';
  return next;
}

export function recordProgramWorkout(program: Program, date: string, reps: number, completedAt = new Date().toISOString()): Program {
  const next = reconcileProgram(program, date);
  const day = next.days.find(item => item.date === date && item.kind === 'training');
  if (!day || day.status !== 'upcoming') return next;
  const actual = Math.max(0, Math.round(reps));
  const success = actual >= day.target;
  day.actualReps = actual;
  day.completedAt = completedAt;
  day.status = success ? 'completed' : 'failed';

  if (success) {
    next.workoutStreak += 1;
    next.bestWorkoutStreak = Math.max(next.bestWorkoutStreak, next.workoutStreak);
  } else {
    next.workoutStreak = 0;
  }

  const upcoming = nextTraining(next, day.index);
  if (!upcoming) return next;
  if (!success) {
    next.confidentStreak = 0;
    upcoming.target = actual >= day.target * 0.8 ? day.target : Math.max(next.baseline, day.target - next.step);
    upcoming.level = Math.max(0, Math.round((upcoming.target - next.baseline) / next.step));
    return next;
  }

  const confident = actual >= day.target + next.step;
  next.confidentStreak = confident ? next.confidentStreak + 1 : 0;
  if (next.confidentStreak >= 2) {
    upcoming.target += next.step;
    upcoming.level += 1;
    next.confidentStreak = 0;
  }
  return next;
}

export function todayProgramDay(program: Program, today = localDateKey()) {
  return program.days.find(day => day.date === today) ?? null;
}

export function nextProgramTraining(program: Program, today = localDateKey()) {
  return program.days.find(day => day.date >= today && day.kind === 'training' && day.status === 'upcoming') ?? null;
}

export function programSummary(program: Program): ProgramSummary {
  const workouts = program.days.filter(day => day.kind === 'training');
  const finished = workouts.filter(day => day.status === 'completed');
  const control = workouts.find(day => day.index === 29)?.actualReps ?? null;
  const best = Math.max(0, ...workouts.map(day => day.actualReps ?? 0));
  return {
    baseline: program.baseline,
    control,
    best,
    completed: finished.length,
    total: workouts.length,
    adherence: Math.round((finished.length / workouts.length) * 100),
  };
}

export function isProgram(value: unknown): value is Program {
  if (!value || typeof value !== 'object') return false;
  const p = value as Program;
  return Number.isFinite(p.baseline) && Number.isFinite(p.step) && typeof p.startDate === 'string' && Array.isArray(p.days) && p.days.length === 30;
}
