import assert from 'node:assert/strict';
import test from 'node:test';
import {
  acceptedErrors,
  coachLessonCatalog,
  coachLessonIds,
  fallbackVideoReply,
  hasInternalCoachDetails,
  needsFollowUp,
  normalizeChecks,
  selectLessonIds,
  techniqueScore,
} from '../supabase/functions/coach/policy';

const check = (overrides: Record<string, unknown> = {}) => ({
  code: 'elbows_flared',
  status: 'fail',
  observation: 'Локти заметно расходятся в нижней фазе.',
  correction: 'Направляй локти немного назад.',
  confidence: 0.9,
  evidence_frames: [3, 8],
  severity: 'moderate',
  ...overrides,
});

test('accepts a repeated high-confidence issue from a suitable view', () => {
  const errors = acceptedErrors(normalizeChecks([check()]), 'front');
  assert.equal(errors.length, 1);
  assert.deepEqual(errors[0]?.evidenceFrames, [3, 8]);
});

test('rejects low-confidence and single-frame findings', () => {
  assert.equal(acceptedErrors(normalizeChecks([check({ confidence: 0.79 })]), 'front').length, 0);
  assert.equal(acceptedErrors(normalizeChecks([check({ evidence_frames: [3] })]), 'front').length, 0);
});

test('rejects a finding from a view that cannot prove it', () => {
  const head = check({ code: 'head_forward', confidence: 0.95 });
  assert.equal(acceptedErrors(normalizeChecks([head]), 'front').length, 0);
  assert.equal(acceptedErrors(normalizeChecks([head]), 'side').length, 1);
});

test('does not require another upload after a good assessment', () => {
  assert.equal(needsFollowUp([], 'good'), false);
  assert.equal(needsFollowUp([], 'cannot_assess'), true);
  assert.equal(needsFollowUp(acceptedErrors(normalizeChecks([check()]), 'front'), 'needs_adjustment'), true);
});

test('keeps internal metrics and frame references out of the public reply', () => {
  assert.equal(hasInternalCoachDetails('Локти расходятся на кадрах 3 и 8, confidence 0.91.'), true);
  assert.equal(hasInternalCoachDetails('Локти немного расходятся. Направляй их чуть назад.'), false);
});

test('builds a readable fallback without technical values', () => {
  const errors = acceptedErrors(normalizeChecks([check()]), 'front');
  const reply = fallbackVideoReply({
    verdict: 'needs_adjustment',
    view: 'front',
    strengths: ['Ладони стоят симметрично', 'Руки полностью разгибаются'],
    errors,
  });

  assert.match(reply, /В целом движение выглядит уверенно/);
  assert.match(reply, /Ладони стоят симметрично/);
  assert.match(reply, /линию корпуса и положение таза/);
  assert.equal(hasInternalCoachDetails(reply), false);
});

test('selects one prepared lesson for every confirmed supported issue', () => {
  const errors = acceptedErrors(normalizeChecks([
    check(),
    check({ code: 'hands_too_wide', observation: 'Ладони стоят слишком широко.', correction: 'Поставь ладони немного ближе.', confidence: 0.92, evidence_frames: [3, 7] }),
    check({ code: 'asymmetry', observation: 'Одна сторона опускается быстрее.', correction: 'Опускай плечи одновременно.', confidence: 0.95, evidence_frames: [4, 8] }),
  ]), 'front');

  assert.deepEqual(selectLessonIds(errors), ['elbows_flared', 'hands_too_wide', 'asymmetry']);
});

test('every prepared lesson has a usable description and correction', () => {
  for (const id of coachLessonIds) {
    assert.ok(coachLessonCatalog[id].title.length > 3, `${id} title`);
    assert.ok(coachLessonCatalog[id].description.length > 20, `${id} description`);
    assert.ok(coachLessonCatalog[id].correction.length > 20, `${id} correction`);
  }
});

test('selects the new side-view correction lessons', () => {
  const errors = acceptedErrors(normalizeChecks([
    check({ code: 'head_forward', observation: 'Голова тянется к полу.', correction: 'Сохраняй шею нейтрально.', confidence: 0.94, evidence_frames: [3, 8] }),
    check({ code: 'hand_position', observation: 'Ладони стоят далеко впереди плеч.', correction: 'Верни ладони ближе под плечи.', confidence: 0.91, evidence_frames: [4, 9] }),
    check({ code: 'body_not_rigid', observation: 'Таз и плечи движутся отдельно.', correction: 'Напряги корпус.', confidence: 0.9, evidence_frames: [5, 10] }),
  ]), 'side');

  assert.deepEqual(selectLessonIds(errors), ['head_forward', 'hand_position', 'body_not_rigid']);
});

test('scores clean technique highest and combines multiple issue severities', () => {
  assert.equal(techniqueScore([], 'good'), 10);
  assert.equal(techniqueScore([], 'cannot_assess'), null);
  const errors = acceptedErrors(normalizeChecks([
    check({ severity: 'mild' }),
    check({ code: 'hands_too_wide', confidence: 0.92, evidence_frames: [4, 9], severity: 'severe' }),
  ]), 'front');
  assert.equal(techniqueScore(errors, 'needs_adjustment'), 6.5);
});
