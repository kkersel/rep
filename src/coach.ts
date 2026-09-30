import AsyncStorage from '@react-native-async-storage/async-storage';
import { ensureGuest, isSupabaseConfigured, supabase } from './supabase';
import { extractVideoFrames, type CoachVideoFrame } from './videoFrames';
import { isCoachLessonId, type CoachLessonId } from './coachLessons';
import type { CoachVideoAsset } from './coachVideo';
import type { CoachEngineMetrics } from './coachEngineMetrics';

export type CoachRole = 'user' | 'assistant';
export type CoachShot = 'front' | 'side' | 'diagonal' | null;
export type CoachMode = 'direct' | 'insights';
export type CoachTechniqueError = {
  code: string;
  observation: string;
  correction: string;
  severity: 'mild' | 'moderate' | 'severe';
  confidence: number;
  evidenceFrames?: number[];
};
export type CoachMessage = {
  id: string;
  role: CoachRole;
  content: string;
  createdAt?: string;
  video?: boolean;
  score?: number | null;
  workout?: {
    mode: 'program' | 'light' | 'free';
    reps: number;
    seconds: number;
    goal: number;
    programDay?: number;
  };
  focus?: string;
  errors?: (CoachTechniqueError | string)[];
  strengths?: string[];
  nextStep?: string;
  followUp?: string;
  nextShot?: CoachShot;
  lessonId?: CoachLessonId | null;
  lessonIds?: CoachLessonId[];
  mode?: CoachMode;
};
export type CoachContext = Record<string, unknown>;

const CHAT_STORE = 'rep.coach.messages.v1';
export const initialCoachMessage: CoachMessage = {
  id: 'coach-intro',
  role: 'assistant',
  content: 'Сними 8–12 секунд фронтально: 3–5 обычных отжиманий, телефон поставь на уровне пола. Я выберу ключевые кадры, разберу технику и при необходимости попрошу ещё один ракурс.',
  nextShot: 'front',
};

function timestampFromMessageId(id: string) {
  const match = id.match(/-(\d{13})$/);
  if (!match) return undefined;
  const value = Number(match[1]);
  return Number.isFinite(value) ? new Date(value).toISOString() : undefined;
}

function inferredLegacyScore(message: CoachMessage) {
  if (!message.id.startsWith('workout-coach-') || !message.errors?.length) return undefined;
  const penalty = message.errors.reduce((sum, issue) => {
    if (typeof issue === 'string') return sum + .8;
    return sum + ({ mild: .8, moderate: 1.6, severe: 2.6 }[issue.severity] ?? .8);
  }, 0);
  return Math.max(1, Math.min(10, Math.round((10 - penalty) * 2) / 2));
}

function normalizeStoredMessage(message: CoachMessage): CoachMessage {
  return {
    ...message,
    createdAt: message.createdAt ?? timestampFromMessageId(message.id),
    score: message.score === null || typeof message.score === 'number'
      ? message.score
      : inferredLegacyScore(message),
  };
}

export async function loadCoachMessages(): Promise<CoachMessage[]> {
  try {
    const raw = await AsyncStorage.getItem(CHAT_STORE);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!Array.isArray(parsed) || !parsed.length) return [initialCoachMessage];
    return parsed.filter((message: CoachMessage, index: number, messages: CoachMessage[]) => {
      const previous = messages[index - 1];
      return !previous
        || message.role !== 'user'
        || previous.role !== 'user'
        || message.content !== previous.content
        || Boolean(message.video) !== Boolean(previous.video);
    }).map(normalizeStoredMessage);
  } catch {
    return [initialCoachMessage];
  }
}

export async function saveCoachMessages(messages: CoachMessage[]) {
  await AsyncStorage.setItem(CHAT_STORE, JSON.stringify(messages.slice(-40)));
}

export async function askCoach({
  nickname,
  message,
  history,
  context,
  video,
  frames: providedFrames,
  engineMetrics,
  mode,
}: {
  nickname: string;
  message: string;
  history: CoachMessage[];
  context: CoachContext;
  video?: CoachVideoAsset | null;
  frames?: CoachVideoFrame[];
  engineMetrics?: CoachEngineMetrics | null;
  mode: CoachMode;
}) {
  if (!isSupabaseConfigured || !supabase) throw new Error('AI-тренер ещё не подключён к серверу');
  await ensureGuest(nickname.trim() || 'Атлет');
  const frames = providedFrames?.length ? providedFrames.slice(0, 12) : video ? await extractVideoFrames(video) : [];
  const response = await supabase.functions.invoke('coach', {
    body: {
      message,
      mode,
      frames,
      context: { ...context, engineMetrics: engineMetrics ?? null },
      history: history.slice(-12).map(item => ({ role: item.role, content: item.content })),
    },
  });
  if (response.error) throw response.error;
  const data = response.data as { reply: string; focus?: string; verdict?: unknown; view?: unknown; score?: unknown; errors?: unknown; strengths?: unknown; nextStep?: unknown; followUp?: unknown; nextShot?: CoachShot; lessonId?: unknown; lessonIds?: unknown };
  const errors = Array.isArray(data.errors) ? data.errors.slice(0, 3).flatMap(item => {
    if (!item || typeof item !== 'object') return [];
    const candidate = item as Record<string, unknown>;
    if (typeof candidate.observation !== 'string' || typeof candidate.correction !== 'string') return [];
    return [{
      code: typeof candidate.code === 'string' ? candidate.code : 'other',
      observation: candidate.observation,
      correction: candidate.correction,
      severity: candidate.severity === 'severe' || candidate.severity === 'moderate' ? candidate.severity : 'mild',
      confidence: typeof candidate.confidence === 'number' ? candidate.confidence : 0,
      evidenceFrames: Array.isArray(candidate.evidenceFrames)
        ? candidate.evidenceFrames.filter((value): value is number => typeof value === 'number')
        : [],
    } satisfies CoachTechniqueError];
  }) : [];
  return {
    reply: data.reply,
    verdict: (data.verdict === 'good' || data.verdict === 'needs_adjustment' || data.verdict === 'cannot_assess' ? data.verdict : 'cannot_assess') as 'good'|'needs_adjustment'|'cannot_assess',
    view: (data.view === 'front' || data.view === 'side' || data.view === 'diagonal' || data.view === 'mixed' ? data.view : 'unknown') as 'front'|'side'|'diagonal'|'mixed'|'unknown',
    score: typeof data.score === 'number' && Number.isFinite(data.score) ? Math.max(1, Math.min(10, data.score)) : null,
    focus: data.focus ?? '',
    errors,
    strengths: Array.isArray(data.strengths) ? data.strengths.filter((item): item is string => typeof item === 'string').slice(0, 3) : [],
    nextStep: typeof data.nextStep === 'string' ? data.nextStep : '',
    followUp: typeof data.followUp === 'string' ? data.followUp : '',
    nextShot: data.nextShot ?? null,
    lessonId: isCoachLessonId(data.lessonId) ? data.lessonId : null,
    lessonIds: Array.isArray(data.lessonIds)
      ? data.lessonIds.filter(isCoachLessonId).filter((item, index, values) => values.indexOf(item) === index).slice(0, 3)
      : isCoachLessonId(data.lessonId) ? [data.lessonId] : [],
  };
}
