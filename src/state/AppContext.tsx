import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { loadSnapshot, saveHistory, saveProfile, saveProgram, startFreshProgram, type LocalProfile, type WorkoutSession } from '../data';
import { localDateKey, recordProgramWorkout, type Program } from '../program';
import { fetchFriendLeaderboard, isSupabaseConfigured, syncTrainingData, type FriendLeader } from '../supabase';

type AppContextValue = {
  loaded: boolean;
  program: Program | null;
  history: WorkoutSession[];
  profile: LocalProfile;
  suggestedBaseline: number;
  error: string;
  leaders: FriendLeader[];
  refreshLeaders: () => Promise<void>;
  createProgram: (baseline: number) => Promise<void>;
  restartProgram: (baseline: number) => Promise<void>;
  recordSession: (session: WorkoutSession) => Promise<void>;
  updateProfile: (profile: LocalProfile) => Promise<void>;
  clearError: () => void;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [program, setProgram] = useState<Program | null>(null);
  const [history, setHistory] = useState<WorkoutSession[]>([]);
  const [profile, setProfile] = useState<LocalProfile>({ nickname: '' });
  const [suggestedBaseline, setSuggestedBaseline] = useState(5);
  const [error, setError] = useState('');
  const [leaders, setLeaders] = useState<FriendLeader[]>([]);

  useEffect(() => {
    loadSnapshot().then(snapshot => {
      setProgram(snapshot.program);
      setHistory(snapshot.history);
      setProfile(snapshot.profile);
      setSuggestedBaseline(snapshot.legacyBaseline ?? 5);
    }).catch(() => setError('Не удалось загрузить данные приложения.')).finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || !profile.userId || !program || !history.some(item => !item.synced)) return;
    const timer = setTimeout(() => { void syncTrainingData(program, history).then(next => { setHistory(next); return saveHistory(next); }).catch(() => {}); }, 500);
    return () => clearTimeout(timer);
  }, [program, history, profile.userId]);

  const refreshLeaders = useCallback(async () => {
    if (!isSupabaseConfigured || !profile.userId) return;
    try { setLeaders(await fetchFriendLeaderboard()); } catch { /* Keep the last successful list offline. */ }
  }, [profile.userId]);

  useEffect(() => {
    const timer = setTimeout(() => { void refreshLeaders(); }, 0);
    return () => clearTimeout(timer);
  }, [refreshLeaders, history]);

  const create = useCallback(async (baseline: number) => {
    const next = await startFreshProgram(baseline);
    setProgram(next);
    setError('');
  }, []);

  const recordSession = useCallback(async (session: WorkoutSession) => {
    const nextHistory = [session, ...history.filter(item => item.id !== session.id)];
    let nextProgram = program;
    if (program && session.mode === 'program') {
      nextProgram = recordProgramWorkout(program, localDateKey(session.date), session.reps, session.date);
    }
    try {
      await Promise.all([saveHistory(nextHistory), saveProgram(nextProgram)]);
      setHistory(nextHistory);
      setProgram(nextProgram);
      setError('');
    } catch {
      setError('Не удалось сохранить тренировку.');
      throw new Error('save failed');
    }
  }, [history, program]);

  const updateProfile = useCallback(async (next: LocalProfile) => {
    await saveProfile(next);
    setProfile(next);
  }, []);

  const value = useMemo<AppContextValue>(() => ({
    loaded, program, history, profile, suggestedBaseline, error, leaders,
    createProgram: create, restartProgram: create, recordSession, updateProfile,
    refreshLeaders,
    clearError: () => setError(''),
  }), [loaded, program, history, profile, suggestedBaseline, error, leaders, create, recordSession, updateProfile, refreshLeaders]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp must be used inside AppProvider');
  return value;
}
