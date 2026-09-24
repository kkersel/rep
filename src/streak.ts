export type StreakPlan = {
  minimum: number;
  increase: number;
  streak: number;
  bestStreak: number;
  lastCompletedDate: string | null;
};

export const localDateKey = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const dateNumber = (key: string) => {
  const [year, month, day] = key.split('-').map(Number);
  return Date.UTC(year, month - 1, day) / 86400000;
};

export function normalizePlan(plan: StreakPlan, today = localDateKey()): StreakPlan {
  if (!plan.lastCompletedDate || dateNumber(today) - dateNumber(plan.lastCompletedDate) <= 1) return plan;
  return { ...plan, streak: 0, lastCompletedDate: null };
}

export function targetForToday(plan: StreakPlan, today = localDateKey()) {
  const normalized = normalizePlan(plan, today);
  const completedToday = normalized.lastCompletedDate === today;
  return normalized.minimum + Math.max(0, normalized.streak - (completedToday ? 1 : 0)) * normalized.increase;
}

export function completeStreak(plan: StreakPlan, reps: number, today = localDateKey()) {
  const normalized = normalizePlan(plan, today);
  const target = targetForToday(normalized, today);
  if (normalized.lastCompletedDate === today || reps < target) return normalized;
  const streak = normalized.streak + 1;
  return { ...normalized, streak, bestStreak: Math.max(normalized.bestStreak, streak), lastCompletedDate: today };
}
