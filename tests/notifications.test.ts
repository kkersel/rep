import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildNotificationPlan, type NotificationSettings } from '../src/notificationPlan.ts';
import { createProgram, recordProgramWorkout } from '../src/program.ts';

const settings: NotificationSettings = {
  notificationsEnabled: true,
  workoutReminders: true,
  eveningReminder: true,
  motivationNotifications: false,
  reminderHour: 9,
  motivationPerWeek: 1,
};

test('schedules a program reminder and an evening follow-up for an unfinished workout', () => {
  const program = createProgram(10, '2026-09-01');
  const plan = buildNotificationPlan(program, settings, new Date(2026, 8, 1, 8));
  const today = plan.filter(item => item.key.endsWith('2026-09-01'));
  assert.deepEqual(today.map(item => item.kind), ['workout', 'evening']);
  assert.equal(today[0].date.getHours(), 9);
  assert.equal(today[1].date.getHours(), 20);
  assert.equal(today[1].date.getMinutes(), 30);
});

test('does not schedule the evening follow-up after the program workout is completed', () => {
  let program = createProgram(10, '2026-09-01');
  program = recordProgramWorkout(program, '2026-09-01', 10);
  const plan = buildNotificationPlan(program, settings, new Date(2026, 8, 1, 12));
  assert.equal(plan.some(item => item.key.endsWith('2026-09-01')), false);
});

test('motivation stays sparse and avoids program training days', () => {
  const program = createProgram(10, '2026-09-01');
  const plan = buildNotificationPlan(program, { ...settings, workoutReminders: false, eveningReminder: false, motivationNotifications: true, motivationPerWeek: 2 }, new Date(2026, 8, 1, 8));
  const motivation = plan.filter(item => item.kind === 'motivation');
  const trainingDates = new Set(program.days.filter(day => day.kind !== 'recovery').map(day => day.date));
  assert.equal(motivation.length, 4);
  assert.equal(motivation.some(item => trainingDates.has(item.key.split('-').slice(1, 4).join('-'))), false);
});

test('master notification switch cancels the entire plan', () => {
  const program = createProgram(10, '2026-09-01');
  assert.deepEqual(buildNotificationPlan(program, { ...settings, notificationsEnabled: false }, new Date(2026, 8, 1, 8)), []);
});
