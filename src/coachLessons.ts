export const coachLessonIds = [
  'hips_sag',
  'hips_high',
  'elbows_flared',
  'hands_too_wide',
  'shallow_depth',
  'head_forward',
  'hand_position',
  'asymmetry',
  'body_not_rigid',
] as const;

export type CoachLessonId = (typeof coachLessonIds)[number];

export const coachLessons: Record<CoachLessonId, {
  title: string;
  description: string;
  cue: string;
  source: number;
}> = {
  hips_sag: {
    title: 'Таз провисает',
    description: 'Боковой ракурс: таз опускается ниже линии плеч и пяток.',
    cue: 'Напряги пресс и ягодицы. Корпус движется одной линией.',
    source: require('../assets/technique/hips-sag-correction-loop.mp4'),
  },
  hips_high: {
    title: 'Таз слишком высоко',
    description: 'Боковой ракурс: таз остаётся выше линии плеч и пяток.',
    cue: 'Опусти таз до линии плеч и пяток, не меняя положение спины.',
    source: require('../assets/technique/hips-high-correction-loop.mp4'),
  },
  elbows_flared: {
    title: 'Локти расходятся',
    description: 'Фронтальный ракурс: локти уходят далеко в стороны вместо контролируемой траектории назад.',
    cue: 'Направляй локти назад под комфортным углом, без формы буквы Т.',
    source: require('../assets/technique/elbows-flared-front-correction-loop.mp4'),
  },
  hands_too_wide: {
    title: 'Руки слишком широко',
    description: 'Фронтальный ракурс: ладони стоят заметно шире плеч в обычном отжимании.',
    cue: 'Для обычного отжимания поставь ладони немного шире плеч.',
    source: require('../assets/technique/hands-too-wide-correction-loop.mp4'),
  },
  shallow_depth: {
    title: 'Не хватает глубины',
    description: 'Боковой или диагональный ракурс: грудь остаётся слишком высоко в нижней точке.',
    cue: 'Опускай грудь ниже под контролем, сохраняя корпус жёстким.',
    source: require('../assets/technique/shallow-depth-correction-loop.mp4'),
  },
  head_forward: {
    title: 'Голова уходит вперёд',
    description: 'Боковой ракурс: голова тянется к полу отдельно от корпуса и шея теряет нейтраль.',
    cue: 'Сохраняй шею продолжением спины и опускай корпус целиком.',
    source: require('../assets/technique/head-forward-correction-loop.mp4'),
  },
  hand_position: {
    title: 'Ладони слишком далеко',
    description: 'Боковой ракурс: ладони вынесены далеко вперёд относительно плеч.',
    cue: 'Верни ладони ближе под плечи, чтобы не тянуться корпусом вперёд.',
    source: require('../assets/technique/hand-position-forward-correction-loop.mp4'),
  },
  asymmetry: {
    title: 'Корпус опускается неровно',
    description: 'Фронтальный ракурс: одно плечо или одна сторона корпуса стабильно опережает другую.',
    cue: 'Распредели вес между ладонями и опускай оба плеча одновременно.',
    source: require('../assets/technique/asymmetric-descent-correction-loop.mp4'),
  },
  body_not_rigid: {
    title: 'Корпус теряет линию',
    description: 'Боковой ракурс: плечи, таз и ноги движутся не как единый жёсткий блок.',
    cue: 'Напряги пресс и ягодицы, чтобы плечи и таз двигались вместе.',
    source: require('../assets/technique/body-not-rigid-correction-loop.mp4'),
  },
};

export function isCoachLessonId(value: unknown): value is CoachLessonId {
  return typeof value === 'string' && coachLessonIds.includes(value as CoachLessonId);
}
