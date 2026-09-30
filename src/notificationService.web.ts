import type { Program } from './program';
import type { NotificationSettings } from './notificationPlan';

export async function requestNotificationAccess() { return false; }
export async function syncNotificationSchedule(_program: Program | null, _settings: NotificationSettings) {}
export function subscribeNotificationResponses(_onOpen: (url: string) => void) { return () => {}; }
