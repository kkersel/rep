import type { PushupVariation, TechniqueView } from './techniqueMetrics';

export type ReferenceSource = {
  id: string;
  title: string;
  author: string;
  url: string;
  publishedAt: string;
  views: number;
  likes: number;
  sourceScore: 10;
  variation: PushupVariation;
  usefulViews: TechniqueView[];
  status: 'needs_clip_review' | 'approved' | 'rejected';
  notes: string;
};

/**
 * Curated source list. A 10/10 source is useful and trustworthy enough for
 * manual clip review; it does not mean that every frame is an ideal rep.
 */
export const pushupReferenceSources: ReferenceSource[] = [
  {
    id: 'calimove-perfect-pushup',
    title: 'The Perfect Push Up | Do it right!',
    author: 'Calisthenicmovement',
    url: 'https://www.youtube.com/watch?v=IODxDxX7oi4',
    publishedAt: '2016-06-16',
    views: 40_989_807,
    likes: 690_000,
    sourceScore: 10,
    variation: 'standard',
    usefulViews: ['side', 'diagonal'],
    status: 'needs_clip_review',
    notes: 'Use only uninterrupted demonstrations explicitly presented as correct form.',
  },
  {
    id: 'fitnessfaqs-common-mistakes',
    title: 'NEVER DO PUSHUPS LIKE THIS | 10 Most Common Mistakes',
    author: 'FitnessFAQs',
    url: 'https://www.youtube.com/watch?v=lnR_kb5Wjf8',
    publishedAt: '2018-04-05',
    views: 11_780_364,
    likes: 117_000,
    sourceScore: 10,
    variation: 'standard',
    usefulViews: ['side', 'diagonal'],
    status: 'needs_clip_review',
    notes: 'Exclude every segment that demonstrates a named mistake or a non-standard variation.',
  },
  {
    id: 'jeremy-ethier-pushup-strength',
    title: 'How To Unlock Your Push Up Strength (In 5 Minutes)',
    author: 'Jeremy Ethier',
    url: 'https://www.youtube.com/watch?v=Z88Rl5bpnmI',
    publishedAt: '2021-07-25',
    views: 6_521_434,
    likes: 250_000,
    sourceScore: 10,
    variation: 'standard',
    usefulViews: ['front', 'side', 'diagonal'],
    status: 'needs_clip_review',
    notes: 'Good setup and execution coverage; retain only full-body, uncut repetitions.',
  },
  {
    id: 'nasm-proper-pushup',
    title: 'How to do a Push-Up | Proper Form & Technique',
    author: 'National Academy of Sports Medicine',
    url: 'https://www.youtube.com/watch?v=WDIpL0pjun0',
    publishedAt: '2021-04-28',
    views: 1_044_919,
    likes: 4_900,
    sourceScore: 10,
    variation: 'standard',
    usefulViews: ['side', 'diagonal'],
    status: 'needs_clip_review',
    notes: 'Institutional reference for neutral spine, controlled depth and head position.',
  },
  {
    id: 'squat-university-pushups',
    title: 'Your Push-Ups Are WRONG (Here’s Why)',
    author: 'Squat University',
    url: 'https://www.youtube.com/watch?v=Yd1grZkAark',
    publishedAt: '2025-07-05',
    views: 107_361,
    likes: 5_100,
    sourceScore: 10,
    variation: 'standard',
    usefulViews: ['front', 'side', 'diagonal'],
    status: 'needs_clip_review',
    notes: 'Recent multi-angle source; exclude correction demonstrations and progressions.',
  },
];
