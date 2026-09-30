import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { Program } from './program';
import { buildNotificationPlan, type NotificationSettings } from './notificationPlan';

const CHANNEL_ID = 'training-reminders';
const IDENTIFIER_PREFIX = 'rep-reminder-';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Тренировки',
    description: 'Напоминания о программе и короткой активности',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 120],
    lightColor: '#0A84FF',
  });
}

async function cancelRepNotifications() {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(scheduled.filter(item => item.identifier.startsWith(IDENTIFIER_PREFIX)).map(item => Notifications.cancelScheduledNotificationAsync(item.identifier)));
}

export async function requestNotificationAccess() {
  await ensureChannel();
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

export async function syncNotificationSchedule(program: Program | null, settings: NotificationSettings) {
  await ensureChannel();
  await cancelRepNotifications();
  if (!settings.notificationsEnabled) return;
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) return;
  const plan = buildNotificationPlan(program, settings);
  for (const item of plan) {
    await Notifications.scheduleNotificationAsync({
      identifier: `${IDENTIFIER_PREFIX}${item.key}`,
      content: {
        title: item.title,
        body: item.body,
        sound: 'default',
        data: { url: '/(tabs)/home', kind: item.kind },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: item.date,
        channelId: CHANNEL_ID,
      },
    });
  }
}

export function subscribeNotificationResponses(onOpen: (url: string) => void) {
  let active = true;
  const open = (response: Notifications.NotificationResponse | null) => {
    const url = response?.notification.request.content.data?.url;
    if (active && typeof url === 'string' && url.startsWith('/')) onOpen(url);
  };
  void Notifications.getLastNotificationResponseAsync().then(response => {
    open(response);
    if (response) return Notifications.clearLastNotificationResponseAsync();
  });
  const subscription = Notifications.addNotificationResponseReceivedListener(open);
  return () => { active = false; subscription.remove(); };
}
