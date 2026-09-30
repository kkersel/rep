alter table public.coach_assessments
drop constraint if exists coach_assessments_lesson_id_check;

alter table public.coach_assessments
add constraint coach_assessments_lesson_id_check
check (
  lesson_id is null or lesson_id in (
    'hips_sag',
    'hips_high',
    'elbows_flared',
    'hands_too_wide',
    'shallow_depth',
    'head_forward',
    'hand_position',
    'asymmetry',
    'body_not_rigid'
  )
);
