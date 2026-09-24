import AsyncStorage from '@react-native-async-storage/async-storage';
import { createProgram, isProgram, localDateKey, reconcileProgram, type Program } from './program';
import { legacyBaselineFromValue, migrateSessionValue } from './migrations';

export type SessionKind = 'program' | 'free' | 'pvp';
export type PvpOutcome = 'win' | 'loss' | 'draw';
export type WorkoutSession = {
  id: string;
  date: string;
  reps: number;
  seconds: number;
  goal: number;
  mode: SessionKind;
  programDay?: number;
  pvpResult?: PvpOutcome;
  synced?: boolean;
};

export type LocalProfile = { nickname: string; friendCode?: string; userId?: string };
export type AppSnapshot = { program: Program | null; history: WorkoutSession[]; legacyBaseline: number | null; profile: LocalProfile };

const PROGRAM_STORE = 'rep.program.v2';
const SESSION_STORE = 'rep.sessions.v2';
const PROFILE_STORE = 'rep.profile.v1';
const LEGACY_PLAN_STORE = 'rep.plan.v1';
const LEGACY_SESSION_STORE = 'rep.sessions.v1';

const safeJson = (raw: string | null) => { try { return raw ? JSON.parse(raw) : null; } catch { return null; } };

export async function loadSnapshot(today = localDateKey()): Promise<AppSnapshot> {
  const [rawProgram, rawSessions, rawProfile, rawLegacyPlan, rawLegacySessions] = await Promise.all([
    AsyncStorage.getItem(PROGRAM_STORE), AsyncStorage.getItem(SESSION_STORE), AsyncStorage.getItem(PROFILE_STORE),
    AsyncStorage.getItem(LEGACY_PLAN_STORE), AsyncStorage.getItem(LEGACY_SESSION_STORE),
  ]);
  const parsedProgram = safeJson(rawProgram);
  const program = isProgram(parsedProgram) ? reconcileProgram(parsedProgram, today) : null;
  const sessionSource = safeJson(rawSessions) ?? safeJson(rawLegacySessions) ?? [];
  const history = Array.isArray(sessionSource) ? sessionSource.map(migrateSessionValue).filter((item): item is WorkoutSession => !!item) : [];
  const profileValue = safeJson(rawProfile);
  const profile: LocalProfile = profileValue && typeof profileValue.nickname === 'string' ? profileValue : { nickname: '' };
  const legacyPlan = safeJson(rawLegacyPlan);
  const legacyBaseline = !program ? legacyBaselineFromValue(legacyPlan) : null;
  if (program) await AsyncStorage.setItem(PROGRAM_STORE, JSON.stringify(program));
  if (!rawSessions && history.length) await AsyncStorage.setItem(SESSION_STORE, JSON.stringify(history));
  return { program, history, legacyBaseline, profile };
}

export async function saveProgram(program: Program | null) {
  if (program) await AsyncStorage.setItem(PROGRAM_STORE, JSON.stringify(program));
  else await AsyncStorage.removeItem(PROGRAM_STORE);
}

export async function saveHistory(history: WorkoutSession[]) {
  await AsyncStorage.setItem(SESSION_STORE, JSON.stringify(history));
}

export async function saveProfile(profile: LocalProfile) {
  await AsyncStorage.setItem(PROFILE_STORE, JSON.stringify(profile));
}

export async function startFreshProgram(baseline: number) {
  const program = createProgram(baseline);
  await saveProgram(program);
  return program;
}
