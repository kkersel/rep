import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import {
  buildReferenceProfile,
  measureTechniqueFrame,
  profileForPrompt,
  type PosePoint,
  type PushupVariation,
  type TechniqueFrameMetrics,
  type TechniqueView,
} from '../src/techniqueMetrics.ts';

type Clip = {
  id: string;
  traceFile: string;
  startSeconds?: number;
  endSeconds?: number;
  view: TechniqueView;
  variation: PushupVariation;
  approved: boolean;
};
type Source = { id: string; clips: Clip[] };
type Manifest = { version: number; sources: Source[] };
type TraceFrame = Partial<TechniqueFrameMetrics> & {
  timeSeconds?: number;
  t?: number;
  landmarks?: PosePoint[];
  aspectRatio?: number;
  confidence?: number;
  feetVisible?: boolean;
};

const fromObservation = (frame: TraceFrame, timeSeconds: number): TechniqueFrameMetrics | null => {
  if (!Number.isFinite(frame.elbowAngle)) return null;
  return {
    timeSeconds,
    poseConfidence: Number(frame.poseConfidence ?? frame.confidence ?? 0),
    elbowAngle: Number(frame.elbowAngle),
    leftElbowAngle: Number.isFinite(frame.leftElbowAngle) ? Number(frame.leftElbowAngle) : null,
    rightElbowAngle: Number.isFinite(frame.rightElbowAngle) ? Number(frame.rightElbowAngle) : null,
    elbowAsymmetry: Number.isFinite(frame.elbowAsymmetry) ? Number(frame.elbowAsymmetry) : null,
    handWidthRatio: Number.isFinite(frame.handWidthRatio) ? Number(frame.handWidthRatio) : null,
    bodyLineDeviation: Number.isFinite(frame.bodyLineDeviation) ? Number(frame.bodyLineDeviation) : null,
    shoulderToHandsRatio: Number.isFinite(frame.shoulderToHandsRatio) ? Number(frame.shoulderToHandsRatio) : null,
    footSupportVisible: frame.footSupportVisible === true || frame.feetVisible === true,
  };
};

async function main() {
const root = resolve(process.cwd());
const argument = (name: string, fallback: string) => {
  const index = process.argv.indexOf(name);
  return resolve(root, index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback);
};
const manifestPath = argument('--manifest', 'reference-data/sources.json');
const outputPath = argument('--output', 'reference-data/generated/reference-profiles.json');
const sqlPath = outputPath.replace(/\.json$/i, '.sql');

const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Manifest;
const groups = new Map<string, { sourceIds: Set<string>; frames: TechniqueFrameMetrics[] }>();
const rejected: Array<{ sourceId: string; clipId: string; reason: string }> = [];

for (const source of manifest.sources) {
  for (const clip of source.clips ?? []) {
    if (!clip.approved) continue;
    try {
      const trace = JSON.parse(await readFile(resolve(root, clip.traceFile), 'utf8')) as TraceFrame[];
      const measured = trace.flatMap(frame => {
        const timeSeconds = Number(frame.timeSeconds ?? frame.t ?? 0);
        if (clip.startSeconds !== undefined && timeSeconds < clip.startSeconds) return [];
        if (clip.endSeconds !== undefined && timeSeconds > clip.endSeconds) return [];
        const metrics = frame.landmarks
          ? measureTechniqueFrame(frame.landmarks, timeSeconds, frame.aspectRatio ?? 1)
          : fromObservation(frame, timeSeconds);
        return metrics ? [metrics] : [];
      });
      if (measured.length < 8) {
        rejected.push({ sourceId: source.id, clipId: clip.id, reason: 'fewer than 8 valid pose frames' });
        continue;
      }
      const key = `${clip.variation}:${clip.view}`;
      const group = groups.get(key) ?? { sourceIds: new Set<string>(), frames: [] };
      group.sourceIds.add(source.id);
      group.frames.push(...measured);
      groups.set(key, group);
    } catch (error) {
      rejected.push({ sourceId: source.id, clipId: clip.id, reason: error instanceof Error ? error.message : 'trace error' });
    }
  }
}

const profiles = [...groups.entries()].map(([key, group]) => {
  const [variation, view] = key.split(':') as [PushupVariation, TechniqueView];
  const profile = buildReferenceProfile({
    frames: group.frames,
    sourceCount: group.sourceIds.size,
    variation,
    view,
    version: manifest.version,
  });
  return {
    ...profileForPrompt(profile),
    canonical: group.sourceIds.size >= 3 && profile.repCount >= 6,
    sourceIds: [...group.sourceIds],
  };
});

await mkdir(dirname(outputPath), { recursive: true });
const generatedAt = new Date().toISOString();
await writeFile(outputPath, `${JSON.stringify({
  generatedAt,
  version: manifest.version,
  profiles,
  rejected,
}, null, 2)}\n`);
const literal = (value: string) => `'${value.replaceAll("'", "''")}'`;
const sqlRows = profiles.map(profile => `(
  ${profile.version}, ${literal(profile.variation)}, ${literal(profile.view)},
  ${profile.sourceCount}, ${profile.repCount}, ${literal(JSON.stringify(profile.ranges))}::jsonb,
  ${profile.canonical}, array[${profile.sourceIds.map(literal).join(',')}]::text[], ${literal(generatedAt)}::timestamptz
)`);
const sql = sqlRows.length ? `begin;
insert into public.coach_reference_profiles
  (version, variation, view, source_count, rep_count, ranges, canonical, source_ids, generated_at)
values
${sqlRows.join(',\n')}
on conflict (version, variation, view) do update set
  source_count = excluded.source_count,
  rep_count = excluded.rep_count,
  ranges = excluded.ranges,
  canonical = excluded.canonical,
  source_ids = excluded.source_ids,
  generated_at = excluded.generated_at;
commit;
` : '-- No reviewed reference clips are available yet.\n';
await writeFile(sqlPath, sql);

console.log(`Built ${profiles.length} profiles (${profiles.filter(profile => profile.canonical).length} canonical).`);
if (rejected.length) console.log(`Rejected ${rejected.length} clips. See ${outputPath}.`);
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
