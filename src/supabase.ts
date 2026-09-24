import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import type { Program } from './program';
import type { WorkoutSession } from './data';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
export const isSupabaseConfigured = /^https:\/\/.+\.supabase\.co$/.test(url) && key.length > 20;

export const supabase: SupabaseClient | null = isSupabaseConfigured ? createClient(url, key, {
  auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
  realtime: { params: { eventsPerSecond: 12 } },
}) : null;

export type PvpState = 'waiting' | 'countdown' | 'active' | 'finished' | 'cancelled';
export type PvpParticipant = { userId: string; nickname: string; score: number; ready: boolean; connected: boolean };
export type PvpMatch = {
  id: string;
  code: string;
  state: PvpState;
  startAt: string | null;
  endsAt: string | null;
  participants: PvpParticipant[];
  winnerId: string | null;
};

type PvpAction = 'create_private' | 'join_private' | 'queue_random' | 'cancel_queue' | 'status' | 'ready' | 'checkpoint' | 'leave' | 'finalize' | 'rematch' | 'add_friend';
export type FriendLeader = { userId: string; nickname: string; wins: number; reps: number };

export async function ensureGuest(nickname: string) {
  if (!supabase) return { userId: 'demo-user', friendCode: 'DEMO01' };
  let { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    const response = await supabase.auth.signInAnonymously();
    if (response.error) throw response.error;
    session = response.data.session;
  }
  if (!session) throw new Error('Не удалось создать гостевой профиль');
  const friendCode = session.user.id.replace(/-/g, '').slice(0, 6).toUpperCase();
  const { error } = await supabase.from('profiles').upsert({ user_id: session.user.id, nickname, friend_code: friendCode }, { onConflict: 'user_id' });
  if (error) throw error;
  return { userId: session.user.id, friendCode };
}

export async function invokePvp(action: PvpAction, payload: Record<string, unknown> = {}) {
  if (!supabase) throw new Error('PvP-сервер ещё не подключён');
  const response = await supabase.functions.invoke('pvp', { body: { action, ...payload } });
  if (response.error) throw response.error;
  return response.data as { match?: PvpMatch; matchId?: string; code?: string; queued?: boolean; participants?: { user_id: string; nickname: string; score: number }[] };
}

export function subscribeToMatch(matchId: string, onEvent: (event: string, payload: any) => void): RealtimeChannel | null {
  if (!supabase) return null;
  const channel = supabase.channel(`match:${matchId}`, { config: { private: true, presence: { key: matchId } } });
  channel
    .on('broadcast', { event: '*' }, ({ event, payload }) => onEvent(event, payload))
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${matchId}` }, payload => onEvent('match', payload.new))
    .on('presence', { event: 'sync' }, () => onEvent('presence', channel.presenceState()))
    .subscribe(async status => {
      if (status === 'SUBSCRIBED') await channel.track({ onlineAt: new Date().toISOString() });
    });
  return channel;
}

export async function syncTrainingData(program: Program | null, sessions: WorkoutSession[]) {
  if (!supabase) return sessions;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return sessions;
  const userId = session.user.id;
  if (program) {
    const programResult = await supabase.from('programs').upsert({ id: program.id, user_id: userId, baseline: program.baseline, step: program.step, start_date: program.startDate, status: program.status, payload: program, updated_at: new Date().toISOString() });
    if (programResult.error) throw programResult.error;
    const daysResult = await supabase.from('program_days').upsert(program.days.map(day => ({
      program_id: program.id,
      day_index: day.index,
      user_id: userId,
      workout_date: day.date,
      kind: day.kind,
      level: day.level,
      target: day.target,
      status: day.status,
      actual_reps: day.actualReps ?? null,
      completed_at: day.completedAt ?? null,
      updated_at: new Date().toISOString(),
    })), { onConflict: 'program_id,day_index' });
    if (daysResult.error) throw daysResult.error;
  }
  const pending = sessions.filter(item => !item.synced);
  if (!pending.length) return sessions;
  const result = await supabase.from('workout_sessions').upsert(pending.map(item => ({ id: item.id, user_id: userId, performed_at: item.date, reps: item.reps, seconds: item.seconds, goal: item.goal, mode: item.mode, program_day: item.programDay ?? null, pvp_result: item.pvpResult ?? null })));
  if (result.error) throw result.error;
  const ids = new Set(pending.map(item => item.id));
  return sessions.map(item => ids.has(item.id) ? { ...item, synced: true } : item);
}

export async function fetchFriendLeaderboard(): Promise<FriendLeader[]> {
  if (!supabase) return [];
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return [];
  const userId = session.user.id;
  const friendships = await supabase.from('friendships').select('requester_id,addressee_id').eq('status', 'accepted').or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
  if (friendships.error) throw friendships.error;
  const ids = new Set<string>([userId]);
  for (const item of friendships.data ?? []) ids.add(item.requester_id === userId ? item.addressee_id : item.requester_id);
  const userIds = [...ids];
  const now = new Date();
  const weekday = (now.getDay() + 6) % 7;
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - weekday).toISOString();
  const [profilesResult, sessionsResult] = await Promise.all([
    supabase.from('profiles').select('user_id,nickname').in('user_id', userIds),
    supabase.from('workout_sessions').select('user_id,reps,pvp_result').in('user_id', userIds).gte('performed_at', weekStart),
  ]);
  if (profilesResult.error) throw profilesResult.error;
  if (sessionsResult.error) throw sessionsResult.error;
  const totals = new Map<string, { wins: number; reps: number }>();
  for (const id of userIds) totals.set(id, { wins: 0, reps: 0 });
  for (const item of sessionsResult.data ?? []) {
    const total = totals.get(item.user_id) ?? { wins: 0, reps: 0 };
    total.reps += item.reps;
    if (item.pvp_result === 'win') total.wins += 1;
    totals.set(item.user_id, total);
  }
  return (profilesResult.data ?? []).map(item => ({ userId: item.user_id, nickname: item.nickname, ...(totals.get(item.user_id) ?? { wins: 0, reps: 0 }) }))
    .sort((a, b) => b.wins - a.wins || b.reps - a.reps || a.nickname.localeCompare(b.nickname, 'ru'));
}

export async function broadcastScore(channel: RealtimeChannel | null, score: number, sequence: number) {
  if (!channel) return;
  await channel.send({ type: 'broadcast', event: 'score', payload: { score, sequence, sentAt: Date.now() } });
}

export async function removeMatchChannel(channel: RealtimeChannel | null) {
  if (channel && supabase) await supabase.removeChannel(channel);
}
