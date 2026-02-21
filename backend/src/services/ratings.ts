import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

const RATINGS_DIR = join(import.meta.dir, '../../data/ratings');

export interface ClipRating {
  videoId: string;
  clipTitle: string;
  clipUrl: string;
  startTime: number;
  endTime: number;
  contextOverlay: string;
  rating: number;       // 1-10
  approved: boolean;
  ratedAt: string;       // ISO date string
}

export interface VideoRatings {
  videoId: string;
  videoUrl: string;
  topic: string;
  ratings: ClipRating[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Save a clip rating to the local JSON store.
 * Creates or updates the rating file for the given video.
 */
export async function saveClipRating(
  videoId: string,
  videoUrl: string,
  topic: string,
  rating: ClipRating
): Promise<void> {
  // Ensure directory exists
  if (!existsSync(RATINGS_DIR)) {
    await mkdir(RATINGS_DIR, { recursive: true });
  }

  const filePath = join(RATINGS_DIR, `${videoId}.json`);
  let videoRatings: VideoRatings;

  try {
    const existing = await readFile(filePath, 'utf-8');
    videoRatings = JSON.parse(existing);
  } catch {
    // File doesn't exist yet, create new
    videoRatings = {
      videoId,
      videoUrl,
      topic,
      ratings: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  // Check if this clip was already rated (by title + startTime), update it
  const existingIdx = videoRatings.ratings.findIndex(
    r => r.clipTitle === rating.clipTitle && r.startTime === rating.startTime
  );

  if (existingIdx >= 0) {
    videoRatings.ratings[existingIdx] = rating;
  } else {
    videoRatings.ratings.push(rating);
  }

  videoRatings.updatedAt = new Date().toISOString();

  await writeFile(filePath, JSON.stringify(videoRatings, null, 2), 'utf-8');
  console.log(`[Ratings] Saved rating for "${rating.clipTitle}" (${rating.rating}/10) → ${filePath}`);
}

/**
 * Get all ratings for a video, or null if none exist.
 */
export async function getVideoRatings(videoId: string): Promise<VideoRatings | null> {
  const filePath = join(RATINGS_DIR, `${videoId}.json`);
  try {
    const data = await readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}
