export const issueCodes = [
  'hips_sag', 'hips_high', 'elbows_flared', 'hands_too_wide', 'shallow_depth',
  'head_forward', 'body_not_rigid', 'asymmetry', 'unstable_tempo', 'hand_position', 'other',
] as const;

export type IssueCode = (typeof issueCodes)[number];
export type CoachView = 'front' | 'side' | 'diagonal' | 'mixed' | 'unknown';
export type CheckStatus = 'pass' | 'fail' | 'unknown';
export type TechniqueSeverity = 'none' | 'mild' | 'moderate' | 'severe';

export type TechniqueCheck = {
  code: IssueCode;
  status: CheckStatus;
  observation: string;
  correction: string;
  severity: TechniqueSeverity;
  confidence: number;
  evidenceFrames: number[];
};

export type TechniqueError = {
  code: IssueCode;
  observation: string;
  correction: string;
  severity: Exclude<TechniqueSeverity, 'none'>;
  confidence: number;
  evidenceFrames: number[];
};

export const coachLessonIds = [
  'hips_sag', 'hips_high', 'elbows_flared', 'hands_too_wide', 'shallow_depth',
  'head_forward', 'hand_position', 'asymmetry', 'body_not_rigid',
] as const;
export type CoachLessonId = (typeof coachLessonIds)[number];

export const coachLessonCatalog: Record<CoachLessonId, {
  title: string;
  description: string;
  correction: string;
}> = {
  hips_sag: {
    title: 'Таз провисает',
    description: 'Боковой ракурс: таз опускается ниже линии плеч и пяток.',
    correction: 'Напрячь пресс и ягодицы; двигать корпус одной линией.',
  },
  hips_high: {
    title: 'Таз слишком высоко',
    description: 'Боковой ракурс: таз остаётся выше линии плеч и пяток.',
    correction: 'Опустить таз до линии плеч и пяток, сохраняя спину стабильной.',
  },
  elbows_flared: {
    title: 'Локти расходятся',
    description: 'Фронтальный ракурс: локти стабильно уходят далеко в стороны.',
    correction: 'Направлять локти назад под комфортным углом.',
  },
  hands_too_wide: {
    title: 'Руки слишком широко',
    description: 'Фронтальный ракурс: ладони заметно шире плеч в обычном отжимании.',
    correction: 'Поставить ладони немного шире плеч для обычного отжимания.',
  },
  shallow_depth: {
    title: 'Не хватает глубины',
    description: 'Боковой или диагональный ракурс: грудь остаётся слишком высоко в нижней точке.',
    correction: 'Опускать грудь ниже под контролем, не теряя линию корпуса.',
  },
  head_forward: {
    title: 'Голова уходит вперёд',
    description: 'Боковой ракурс: голова тянется к полу отдельно от корпуса.',
    correction: 'Держать шею продолжением спины и опускать корпус целиком.',
  },
  hand_position: {
    title: 'Ладони слишком далеко',
    description: 'Боковой ракурс: ладони вынесены далеко вперёд относительно плеч.',
    correction: 'Вернуть ладони ближе под плечи.',
  },
  asymmetry: {
    title: 'Корпус опускается неровно',
    description: 'Фронтальный ракурс: одно плечо или одна сторона корпуса стабильно опережает другую.',
    correction: 'Распределить вес между ладонями и опускать оба плеча одновременно.',
  },
  body_not_rigid: {
    title: 'Корпус теряет линию',
    description: 'Боковой ракурс: плечи, таз и ноги движутся не как единый жёсткий блок.',
    correction: 'Напрячь пресс и ягодицы, чтобы плечи и таз двигались вместе.',
  },
};

export const coachLessonCatalogPrompt = coachLessonIds
  .map(id => `- ${id}: ${coachLessonCatalog[id].description} Коррекция: ${coachLessonCatalog[id].correction}`)
  .join('\n');

const lessonConfidence: Record<CoachLessonId, number> = {
  hips_sag: 0.68,
  hips_high: 0.68,
  elbows_flared: 0.72,
  hands_too_wide: 0.75,
  shallow_depth: 0.7,
  head_forward: 0.8,
  hand_position: 0.8,
  asymmetry: 0.8,
  body_not_rigid: 0.75,
};

const allowedViews: Partial<Record<IssueCode, CoachView[]>> = {
  hips_sag: ['side', 'diagonal', 'mixed'],
  hips_high: ['side', 'diagonal', 'mixed'],
  elbows_flared: ['front', 'diagonal', 'mixed'],
  hands_too_wide: ['front', 'diagonal', 'mixed'],
  shallow_depth: ['side', 'diagonal', 'mixed'],
  head_forward: ['side', 'diagonal', 'mixed'],
  body_not_rigid: ['side', 'diagonal', 'mixed'],
  asymmetry: ['front', 'diagonal', 'mixed'],
  hand_position: ['side', 'diagonal', 'mixed'],
};

const minimumConfidence: Partial<Record<IssueCode, number>> = {
  elbows_flared: 0.84,
  hands_too_wide: 0.86,
  head_forward: 0.88,
  unstable_tempo: 0.88,
  other: 0.9,
};

export const validIssueCode = (value: unknown): value is IssueCode =>
  typeof value === 'string' && issueCodes.includes(value as IssueCode);

const uniqueFrameNumbers = (value: unknown): number[] => {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .filter((frame): frame is number => Number.isInteger(frame) && frame >= 1 && frame <= 24))]
    .slice(0, 8);
};

export function normalizeChecks(value: unknown): TechniqueCheck[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 10).flatMap(item => {
    if (!item || typeof item !== 'object') return [];
    const candidate = item as Record<string, unknown>;
    if (!validIssueCode(candidate.code)) return [];
    if (candidate.status !== 'pass' && candidate.status !== 'fail' && candidate.status !== 'unknown') return [];
    if (typeof candidate.observation !== 'string' || typeof candidate.correction !== 'string') return [];
    const severity: TechniqueSeverity = candidate.status === 'fail' && (candidate.severity === 'mild' || candidate.severity === 'moderate' || candidate.severity === 'severe')
      ? candidate.severity
      : 'none';
    const confidence = typeof candidate.confidence === 'number'
      ? Math.max(0, Math.min(1, candidate.confidence))
      : 0;
    return [{
      code: candidate.code,
      status: candidate.status,
      observation: candidate.observation.slice(0, 500),
      correction: candidate.correction.slice(0, 500),
      severity,
      confidence,
      evidenceFrames: uniqueFrameNumbers(candidate.evidence_frames),
    }];
  });
}

export function acceptedErrors(checks: TechniqueCheck[], view: CoachView): TechniqueError[] {
  return checks.flatMap(check => {
    if (check.status !== 'fail') return [];
    const threshold = minimumConfidence[check.code] ?? 0.8;
    if (check.confidence < threshold || check.evidenceFrames.length < 2) return [];
    const views = allowedViews[check.code];
    if (views && !views.includes(view)) return [];
    return [{
      code: check.code,
      observation: check.observation,
      correction: check.correction,
      severity: check.severity === 'none' ? 'mild' : check.severity,
      confidence: check.confidence,
      evidenceFrames: check.evidenceFrames,
    }];
  }).slice(0, 3);
}

export function techniqueScore(errors: TechniqueError[], verdict: string): number | null {
  if (verdict === 'cannot_assess') return null;
  const penalty = errors.reduce((sum, error) => sum + ({ mild: 0.8, moderate: 1.6, severe: 2.6 }[error.severity]), 0);
  return Math.max(1, Math.min(10, Math.round((10 - penalty) * 2) / 2));
}

export function needsFollowUp(errors: TechniqueError[], verdict: string) {
  return errors.length > 0 || verdict === 'cannot_assess';
}

export function selectLessonIds(errors: TechniqueError[]): CoachLessonId[] {
  return errors.flatMap(error => {
    if (!coachLessonIds.includes(error.code as CoachLessonId)) return [];
    const lessonId = error.code as CoachLessonId;
    return error.confidence >= lessonConfidence[lessonId] ? [lessonId] : [];
  }).filter((lessonId, index, values) => values.indexOf(lessonId) === index).slice(0, 3);
}

const internalDetailPattern = new RegExp([
  'confidence',
  'evidence[_\\s-]?frames?',
  'engine[_\\s-]?metrics?',
  'pose[_\\s-]?coverage',
  'support[_\\s-]?line',
  'reference[_\\s-]?profile',
  'elbows_flared',
  'hands_too_wide',
  'hips_sag',
  'hips_high',
  'shallow_depth',
  'head_forward',
  'body_not_rigid',
  'asymmetry',
  'hand_position',
  'кадр(?:ы|ах|е)?\\s*№?\\s*\\d+',
  '\\d+(?:[.,]\\d+)?\\s*(?:%|°|градус(?:а|ов)?|px|пиксел(?:ь|я|ей)|×|x)',
].join('|'), 'iu');

export function hasInternalCoachDetails(value: unknown) {
  return typeof value !== 'string' || internalDetailPattern.test(value);
}

export function fallbackVideoReply({
  verdict,
  view,
  strengths,
  errors,
}: {
  verdict: string;
  view: CoachView;
  strengths: string[];
  errors: TechniqueError[];
}) {
  if (verdict === 'cannot_assess') {
    return 'По этому видео пока нельзя уверенно оценить технику. Пришли короткий подход с ракурса, где полностью видны руки, корпус и стопы.';
  }

  const clean = (value: string) => value.trim().replace(/[.!?]+$/, '');
  const parts: string[] = [];
  const mainError = errors[0];

  parts.push(mainError
    ? 'В целом движение выглядит уверенно, но есть один момент, который стоит немного поправить.'
    : 'В целом техника выглядит уверенно: подтверждённых ошибок на этом видео нет.');

  if (strengths.length) {
    parts.push(`Хорошо получается: ${strengths.slice(0, 2).map(clean).join('; ')}.`);
  }

  if (mainError) {
    errors.slice(0, 3).forEach((error, index) => {
      const prefix = index === 0 ? 'Главное' : 'Ещё один момент';
      parts.push(`${prefix}: ${clean(error.observation)}. ${clean(error.correction)}.`);
    });
  }

  if (view === 'front') {
    parts.push('С этого ракурса хорошо видны руки и симметрия, но линию корпуса и положение таза надёжнее проверять сбоку.');
  } else if (view === 'side') {
    parts.push('С этого ракурса хорошо видны глубина и линия корпуса, но симметрию рук надёжнее проверять спереди.');
  }

  return parts.join(' ');
}
