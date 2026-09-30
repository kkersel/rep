import { addLocalDays, localDateKey, type Program } from './program';

export type ReminderHour = 9 | 14 | 18;
export type MotivationFrequency = 1 | 2;

export type NotificationSettings = {
  notificationsEnabled: boolean;
  workoutReminders: boolean;
  eveningReminder: boolean;
  motivationNotifications: boolean;
  reminderHour: ReminderHour;
  motivationPerWeek: MotivationFrequency;
};

export type PlannedNotification = {
  key: string;
  date: Date;
  title: string;
  body: string;
  kind: 'workout' | 'evening' | 'motivation';
};

const motivationCopy = [
  { title: 'Немного движения?', body: 'Короткий подход займёт пару минут и поможет сохранить ритм.' },
  { title: 'Время размяться', body: 'Если есть силы, сделай несколько спокойных отжиманий.' },
  { title: 'Пара минут для себя', body: 'Небольшая активность сегодня лучше идеального плана завтра.' },
  { title: 'Поддержи ритм', body: 'Открой Rep и сделай комфортный подход без гонки за рекордом.' },
] as const;

function dateAt(key: string, hour: number, minute = 0) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

function hash(value: string) {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function workoutDates(program: Program | null) {
  return new Set(program?.days.filter(day => day.kind !== 'recovery').map(day => day.date) ?? []);
}

export function buildNotificationPlan(program: Program | null, settings: NotificationSettings, now = new Date()): PlannedNotification[] {
  if (!settings.notificationsEnabled) return [];
  const result: PlannedNotification[] = [];
  const today = localDateKey(now);

  if (program && program.status === 'active' && settings.workoutReminders) {
    for (const day of program.days) {
      if (day.date < today || day.kind === 'recovery' || day.status !== 'upcoming') continue;
      const primary = dateAt(day.date, settings.reminderHour);
      if (primary.getTime() > now.getTime()) {
        result.push({
          key: `workout-${day.date}`,
          date: primary,
          title: day.kind === 'main' ? 'Пора на тренировку' : 'Лёгкий день',
          body: day.kind === 'main' ? `Сегодня цель — ${day.target} отжиманий.` : `Сегодня спокойный подход на ${day.target}.`,
          kind: 'workout',
        });
      }
      if (settings.eveningReminder) {
        const evening = dateAt(day.date, 20, 30);
        if (evening.getTime() > now.getTime() && evening.getTime() > primary.getTime()) {
          result.push({
            key: `evening-${day.date}`,
            date: evening,
            title: 'Тренировка ещё ждёт',
            body: `Если есть силы, закрой сегодняшнюю цель — ${day.target}.`,
            kind: 'evening',
          });
        }
      }
    }
  }

  if (settings.motivationNotifications) {
    const occupied = workoutDates(program);
    for (let week = 0; week < 2; week += 1) {
      const candidates = Array.from({ length: 7 }, (_, offset) => addLocalDays(today, week * 7 + offset + 1))
        .filter(key => !occupied.has(key))
        .sort((a, b) => hash(`${program?.id ?? 'free'}-${week}-${a}`) - hash(`${program?.id ?? 'free'}-${week}-${b}`));
      const selected: string[] = [];
      for (const key of candidates) {
        const dayNumber = dateAt(key, 12).getTime() / 86400000;
        if (selected.some(item => Math.abs(dateAt(item, 12).getTime() / 86400000 - dayNumber) < 2)) continue;
        selected.push(key);
        if (selected.length >= settings.motivationPerWeek) break;
      }
      selected.forEach((key, index) => {
        const seed = hash(`${program?.id ?? 'free'}-${key}`);
        const copy = motivationCopy[seed % motivationCopy.length];
        const date = dateAt(key, 11 + (seed % 8), seed % 2 ? 30 : 0);
        if (date.getTime() > now.getTime()) result.push({ key: `motivation-${key}-${index}`, date, ...copy, kind: 'motivation' });
      });
    }
  }

  return result.sort((a, b) => a.date.getTime() - b.date.getTime());
}
