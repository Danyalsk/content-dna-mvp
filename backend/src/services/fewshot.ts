import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import type { VideoRatings, ClipRating } from './ratings';

const RATINGS_DIR = join(import.meta.dir, '../../data/ratings');

interface RatedClipWithMeta extends ClipRating {
  topic: string;
}

/**
 * Reads ALL rated clips across all videos, sorted by rating.
 */
async function loadAllRatedClips(): Promise<RatedClipWithMeta[]> {
  if (!existsSync(RATINGS_DIR)) return [];

  const files = await readdir(RATINGS_DIR);
  const jsonFiles = files.filter(f => f.endsWith('.json'));
  const allClips: RatedClipWithMeta[] = [];

  for (const file of jsonFiles) {
    try {
      const raw = await readFile(join(RATINGS_DIR, file), 'utf-8');
      const data: VideoRatings = JSON.parse(raw);
      for (const clip of data.ratings) {
        allClips.push({ ...clip, topic: data.topic });
      }
    } catch {
      // Skip malformed files
    }
  }

  return allClips;
}

/**
 * Returns the top N highest-rated clips (rating >= 8) formatted as golden examples.
 */
export async function getGoldenExamples(n: number = 3): Promise<string> {
  const clips = await loadAllRatedClips();
  const golden = clips
    .filter(c => c.rating >= 8 && c.approved)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, n);

  if (golden.length === 0) return '';

  const examples = golden.map((c, i) =>
    `  ${i + 1}. Title: "${c.clipTitle}" | Duration: ${(c.endTime - c.startTime).toFixed(0)}s | Context: "${c.contextOverlay}" | Rating: ${c.rating}/10`
  );

  return [
    'GOLDEN EXAMPLES — The user LOVED these clips. Generate clips with SIMILAR quality:',
    ...examples,
  ].join('\n');
}

/**
 * Returns the bottom N lowest-rated clips (rating <= 3) formatted as anti-examples.
 */
export async function getAntiExamples(n: number = 3): Promise<string> {
  const clips = await loadAllRatedClips();
  const bad = clips
    .filter(c => c.rating <= 3)
    .sort((a, b) => a.rating - b.rating)
    .slice(0, n);

  if (bad.length === 0) return '';

  const examples = bad.map((c, i) =>
    `  ${i + 1}. Title: "${c.clipTitle}" | Duration: ${(c.endTime - c.startTime).toFixed(0)}s | Context: "${c.contextOverlay}" | Rating: ${c.rating}/10`
  );

  return [
    'ANTI-EXAMPLES — The user HATED these clips. Do NOT produce anything like them:',
    ...examples,
  ].join('\n');
}

/**
 * Builds the complete few-shot block for prompt injection.
 */
export async function buildFewShotBlock(): Promise<string> {
  const [golden, anti] = await Promise.all([
    getGoldenExamples(3),
    getAntiExamples(3),
  ]);

  const parts: string[] = [];
  if (golden) parts.push(golden);
  if (anti) parts.push(anti);

  return parts.join('\n\n');
}
