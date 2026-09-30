# Push-up reference pipeline

The repository stores the reproducible manifest and derived pose metrics. Raw
videos remain local under `reference-data/raw/` and are ignored by git.

1. Add each approved source video to `reference-data/raw/`.
2. Review it and record only uninterrupted intervals containing standard,
   technically correct repetitions in `sources.json`.
3. Export a MediaPipe trace for every approved interval as JSON. The existing
   camera test mode emits the normalized measurements directly. A raw trace of
   `{ timeSeconds, landmarks }` with all 33 Pose Landmarker points is also
   accepted and converted by the build script.
4. Run `npm run references:build`.
5. Review `reference-data/generated/reference-profiles.json` before publishing
   it to `coach_reference_profiles`, then run `npm run references:publish`.

Profiles are separated by camera view and push-up variation. Measurements use
angles or body-size-normalized ratios, so height and distance from the camera do
not become technique errors. A metric becomes canonical only after at least
three independent people contribute usable repetitions to that view.

For a local file, use the reproducible extractor:

```bash
python3 -m venv .venv-reference
.venv-reference/bin/pip install -r scripts/reference-requirements.txt
.venv-reference/bin/python scripts/extract_pose_trace.py \
  reference-data/raw/source.mp4 reference-data/traces/source-side.json \
  --start 12.4 --end 21.8
```
