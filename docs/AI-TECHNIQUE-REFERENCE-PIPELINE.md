# AI technique reference pipeline

## Goal

The coach combines two independent signals:

1. a vision model reviews chronological video frames;
2. the on-device MediaPipe engine measures pose geometry and compares it with
   a versioned library of reviewed repetitions.

The language model receives both. It may explain measured deviations, but it
must not invent measurements when tracking coverage is insufficient.

## Reference selection

The initial source list lives in `reference-data/sources.json`. A source earns a
10/10 editorial score only when it satisfies all ten recorded requirements.
Tutorials are never ingested as a whole because they often contain deliberate
mistake demonstrations. A reviewer marks exact start/end times for clean,
uncut repetitions and labels the camera view and push-up variation.

A profile becomes canonical only with at least three independent people and six
complete repetitions for the same `variation × view` group. This prevents one
coach's limb proportions, tempo, camera position or personal style from becoming
a universal target.

## Measurements

The engine stores angles and ratios rather than screen pixels:

- left, right and combined elbow flexion;
- left/right elbow asymmetry;
- hand width divided by shoulder width;
- hip deviation from the projected shoulder-to-ankle body line;
- shoulder height relative to the hand line, normalized by shoulder width;
- pose and foot-support coverage;
- complete top-to-bottom cycles.

Knees are not required. They are commonly hidden by the torso in a frontal view
and previously made honest repetitions fail. Full-body support is inferred from
the foot region and body motion; a knee variation is handled as a separate
declared/detected variation rather than a broken standard repetition.

## View-aware comparison

- Front: hand width, elbow direction and left/right symmetry.
- Side: body line, depth, head position and range of motion.
- Diagonal: only metrics that remain sufficiently visible.

The coach receives all canonical profiles but compares only a matching view and
variation. Missing or incompatible metrics remain `unknown`; they do not become
errors.

## User-video flow

1. The app extracts twelve evenly spaced visual frames for LiteLLM.
2. A hidden local MediaPipe pass scans the short video at 2× speed.
3. The app summarizes pose coverage, foot coverage, repetitions and robust
   metric distributions.
4. Frames and measurements reach the authenticated `coach` Edge Function.
5. The function loads the user's prior technique history and canonical reference
   profiles, then requests a structured assessment from LiteLLM.
6. Only repeated, high-confidence findings with compatible camera views are
   persisted. Videos and raw landmarks are not stored on the server.

## Privacy and storage

Raw trainer videos stay in the ignored `reference-data/raw/` directory. Git and
Supabase contain source attribution, reviewed clip boundaries and derived
statistics. User videos stay on the device; the current analysis sends sampled
JPEG frames to the configured LiteLLM vision endpoint and saves only the
structured assessment in Supabase.

## Remaining curation step

The five source URLs are registered, but their approved clip intervals and
derived profiles remain empty until the actual files are reviewed. Run
`npm run references:build` after adding the files and traces. The command emits
`reference-data/generated/reference-profiles.json` and marks profiles canonical
only after the source-count and repetition-count requirements are met.
