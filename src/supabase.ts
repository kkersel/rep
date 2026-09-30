import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import type { Program } from './program';
import type { PvpOutcome, SessionKind, WorkoutSession } from './data';
import { achievements, ratingDeltaForOutcome, ratingFromHistory, levelForRating, MIN_RATING, START_RATING, type Achievement } from './gamification';
import { sessionStats } from './statistics';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
export const isSupabaseConfigured = /^https:\/\/.+\.supabase\.co$/.test(url) && key.length > 20;

export const supabase: SupabaseClient | null = isSupabaseConfigured ? createClient(url, key, {
  auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
  realtime: { params: { eventsPerSecond: 12 } },
}) : null;

export type PvpState = 'searching' | 'waiting' | 'connecting' | 'camera_ready' | 'countdown' | 'active' | 'finalizing' | 'finished' | 'cancelled';
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

type PvpAction = 'create_private' | 'join_private' | 'queue_random' | 'cancel_queue' | 'status' | 'ready' | 'checkpoint' | 'heartbeat' | 'leave' | 'finalize' | 'rematch' | 'request_rematch' | 'accept_rematch' | 'decline_rematch' | 'add_friend' | 'add_friend_code' | 'remove_friend';
export type FriendLeader = { userId: string; nickname: string; rating: number; level: number; wins: number; reps: number; matches: number; best60: number; mainCompleted: number; adherence: number; streak: number };
export type FriendProfile = {
  userId: string;
  nickname: string;
  rating: number;
  level: number;
  stats: ReturnType<typeof sessionStats>;
  achievements: Achievement[];
};

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
  return response.data as { ok?: boolean; match?: PvpMatch; matchId?: string; code?: string; queued?: boolean; participants?: { user_id: string; nickname: string; score: number }[] };
}

export async function fetchPvpMatch(matchId: string): Promise<PvpMatch> {
  if (!supabase) throw new Error('PvP-сервер ещё не подключён');
  const [matchResult, playersResult] = await Promise.all([
    supabase.from('matches').select('id,code,state,start_at,ends_at,winner_id').eq('id', matchId).single(),
    supabase.from('match_players').select('user_id,nickname,score,ready').eq('match_id', matchId).order('seat'),
  ]);
  if (matchResult.error) throw matchResult.error;
  if (playersResult.error) throw playersResult.error;
  return {
    id: matchResult.data.id,
    code: matchResult.data.code,
    state: matchResult.data.state,
    startAt: matchResult.data.start_at,
    endsAt: matchResult.data.ends_at,
    winnerId: matchResult.data.winner_id,
    participants: (playersResult.data ?? []).map(item => ({
      userId: item.user_id,
      nickname: item.nickname,
      score: item.score,
      ready: item.ready,
      connected: true,
    })),
  };
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
  const pending = sessions.filter(item => !item.synced);
  let nextSessions = sessions;
  if (pending.length) {
    const result = await supabase.from('workout_sessions').upsert(pending.map(item => ({ id: item.mode === 'pvp' ? `${item.id}:${userId}` : item.id, user_id: userId, performed_at: item.date, reps: item.reps, seconds: item.seconds, goal: item.goal, mode: item.mode, program_day: item.programDay ?? null, pvp_result: item.pvpResult ?? null, technique: item.technique ?? null })));
    if (result.error) throw result.error;
    const ids = new Set(pending.map(item => item.id));
    nextSessions = sessions.map(item => ids.has(item.id) ? { ...item, synced: true } : item);
  }
  if (program) {
    try {
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
    } catch {
      // Session results must still reach the leaderboard if program sync needs a retry.
    }
  }
  try {
    const achievementResult = await supabase.from('user_achievements').upsert(achievements(nextSessions, program).map(item => ({
      user_id: userId,
      achievement_id: item.id,
      current: item.current,
      target: item.target,
      unlocked_at: item.unlockedAt ?? null,
      updated_at: new Date().toISOString(),
    })), { onConflict: 'user_id,achievement_id' });
    if (achievementResult.error) throw achievementResult.error;
  } catch {
    // Older backends may not have the achievements table yet; session sync remains usable.
  }
  return nextSessions;
}

export async function fetchFriendProfile(userId: string): Promise<FriendProfile> {
  if (!supabase) throw new Error('Сервер ещё не подключён');
  const [profileResult, sessionsResult, achievementsResult] = await Promise.all([
    supabase.from('profiles').select('user_id,nickname').eq('user_id', userId).single(),
    supabase.from('workout_sessions').select('id,performed_at,reps,seconds,goal,mode,program_day,pvp_result,technique').eq('user_id', userId).order('performed_at', { ascending: true }),
    supabase.from('user_achievements').select('achievement_id,current,target,unlocked_at').eq('user_id', userId),
  ]);
  if (profileResult.error) throw profileResult.error;
  if (sessionsResult.error) throw sessionsResult.error;
  const history: WorkoutSession[] = (sessionsResult.data ?? []).map(item => ({
    id: item.id,
    date: item.performed_at,
    reps: item.reps,
    seconds: item.seconds,
    goal: item.goal,
    mode: item.mode as SessionKind,
    programDay: item.program_day ?? undefined,
    pvpResult: (item.pvp_result as PvpOutcome | null) ?? undefined,
    technique: item.technique ?? undefined,
    synced: true,
  }));
  const stored = new Map((achievementsResult.data ?? []).map(item => [item.achievement_id, item]));
  const collection = achievements(history, null).map(item => {
    const remote = stored.get(item.id);
    return remote ? { ...item, current: remote.current, target: remote.target, unlockedAt: remote.unlocked_at ?? undefined } : item;
  });
  const rank = ratingFromHistory(history);
  return { userId, nickname: profileResult.data.nickname, rating: rank.rating, level: rank.level, stats: sessionStats(history), achievements: collection };
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
    supabase.from('workout_sessions').select('user_id,reps,goal,mode,pvp_result,performed_at').in('user_id', userIds).order('performed_at', { ascending: true }),
  ]);
  if (profilesResult.error) throw profilesResult.error;
  if (sessionsResult.error) throw sessionsResult.error;
  const totals = new Map<string, Omit<FriendLeader,'userId'|'nickname'>>();
  const empty=():Omit<FriendLeader,'userId'|'nickname'>=>({ rating: START_RATING, level: levelForRating(START_RATING).level, wins: 0, reps: 0, matches: 0, best60: 0, mainCompleted: 0, adherence: 0, streak: 0 });
  for (const id of userIds) totals.set(id, empty());
  for (const item of sessionsResult.data ?? []) {
    const total = totals.get(item.user_id) ?? empty();
    total.reps += item.reps;
    if (item.mode === 'pvp') { total.matches += 1; total.best60 = Math.max(total.best60,item.reps); if (item.pvp_result === 'win') total.wins += 1; total.rating = Math.max(MIN_RATING,total.rating+ratingDeltaForOutcome(item.pvp_result)); total.level=levelForRating(total.rating).level; }
    if (+new Date(item.performed_at)>=+new Date(weekStart)&&item.mode === 'program' && item.reps >= item.goal) total.mainCompleted += 1;
    total.adherence = Math.min(100,Math.round(total.mainCompleted/3*100));
    total.streak = total.mainCompleted;
    totals.set(item.user_id, total);
  }
  return (profilesResult.data ?? []).map(item => ({ userId: item.user_id, nickname: item.nickname, ...(totals.get(item.user_id) ?? empty()) }))
    .sort((a, b) => b.rating - a.rating || b.wins - a.wins || a.nickname.localeCompare(b.nickname, 'ru'));
}

export async function broadcastScore(channel: RealtimeChannel | null, score: number, sequence: number) {
  if (!channel) return;
  await channel.send({ type: 'broadcast', event: 'score', payload: { score, sequence, sentAt: Date.now() } });
}

export async function removeMatchChannel(channel: RealtimeChannel | null) {
  if (channel && supabase) await supabase.removeChannel(channel);
}
