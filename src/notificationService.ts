import type { Program } from './program';
import type { NotificationSettings } from './notificationPlan';

// TypeScript fallback. Metro selects notificationService.native.ts or
// notificationService.web.ts for the target platform.
export async function requestNotificationAccess() { return false; }
export async function syncNotificationSchedule(_program: Program | null, _settings: NotificationSettings) {}
export function subscribeNotificationResponses(_onOpen: (url: string) => void) { return () => {}; }
