import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

// ============================================================
// Types
// ============================================================

export type FeedbackCategory =
  | 'clips_too_short'
  | 'clips_too_long'
  | 'bad_titles'
  | 'bad_context_overlays'
  | 'clips_cut_mid_sentence'
  | 'tweets_boring'
  | 'tweets_too_long'
  | 'wrong_segments'
  | 'general';

export interface FeedbackEntry {
  id: string;
  category: FeedbackCategory;
  feedbackText: string;
  refinedInstruction: string;  // AI-rephrased professional instruction
  createdAt: string;
}

export interface DynamicParams {
  minClipDuration: number;
  targetClipDuration: number;
  maxClipDuration: number;
  sentenceSnapBuffer: number;
  titleStyle: string;
  tweetStyle: string;
  extraPromptRules: string[];
}

// ============================================================
// Paths
// ============================================================

const FEEDBACK_DIR = join(import.meta.dir, '../../data/feedback');
const LOG_PATH = join(FEEDBACK_DIR, 'log.json');
const PARAMS_PATH = join(FEEDBACK_DIR, 'params.json');

// ============================================================
// Defaults
// ============================================================

const DEFAULT_PARAMS: DynamicParams = {
  minClipDuration: 15,
  targetClipDuration: 40,
  maxClipDuration: 55,
  sentenceSnapBuffer: 5,
  titleStyle: 'catchy, clickbait-worthy',
  tweetStyle: 'engaging, opinionated',
  extraPromptRules: [],
};

// ============================================================
// Helpers
// ============================================================

async function ensureDir(): Promise<void> {
  if (!existsSync(FEEDBACK_DIR)) {
    await mkdir(FEEDBACK_DIR, { recursive: true });
  }
}

// ============================================================
// Feedback Log CRUD
// ============================================================

export async function saveFeedback(entry: FeedbackEntry): Promise<void> {
  await ensureDir();

  // AI-rephrase the user's raw feedback into a clean instruction
  if (entry.feedbackText && !entry.refinedInstruction) {
    entry.refinedInstruction = await rephraseFeedbackWithAI(entry.category, entry.feedbackText);
  }

  let log: FeedbackEntry[] = [];
  try {
    const raw = await readFile(LOG_PATH, 'utf-8');
    log = JSON.parse(raw);
  } catch {
    // File doesn't exist yet
  }

  log.push(entry);
  await writeFile(LOG_PATH, JSON.stringify(log, null, 2), 'utf-8');
  console.log(`[Feedback] Saved: "${entry.category}"`);
  console.log(`[Feedback] User said: "${entry.feedbackText}"`);
  console.log(`[Feedback] Refined to: "${entry.refinedInstruction}"`);

  // Trigger rule engine for the structured category
  await applyFeedbackRules(entry.category);
}

export async function getAllFeedback(): Promise<FeedbackEntry[]> {
  await ensureDir();
  try {
    const raw = await readFile(LOG_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * Returns the last N feedback entries formatted for prompt injection.
 * Uses the AI-refined instruction, NOT the raw user text.
 */
export async function getFeedbackPromptBlock(limit: number = 5): Promise<string> {
  const all = await getAllFeedback();
  if (all.length === 0) return '';

  const recent = all.slice(-limit);
  const lines = recent
    .filter(f => f.refinedInstruction) // only include entries with refined instructions
    .map((f, i) => `${i + 1}. ${f.refinedInstruction}`);

  if (lines.length === 0) return '';

  return [
    'CRITICAL — LEARNED RULES FROM PAST SESSIONS (you MUST follow these):',
    ...lines,
    'Strictly adhere to every rule above. Violating any of them is a failure.',
  ].join('\n');
}

// ============================================================
// AI Rephrase — converts raw user feedback into a pro instruction
// ============================================================

async function rephraseFeedbackWithAI(category: FeedbackCategory, rawText: string): Promise<string> {
  // Build a category-aware context so the AI understands the domain
  const categoryContext: Record<FeedbackCategory, string> = {
    clips_too_short: 'The user is complaining about video clip duration being too short.',
    clips_too_long: 'The user is complaining about video clip duration being too long.',
    bad_titles: 'The user is unhappy with the quality of generated clip titles.',
    bad_context_overlays: 'The user is unhappy with the text overlays on clips.',
    clips_cut_mid_sentence: 'The user says clips are cutting off in the middle of sentences.',
    tweets_boring: 'The user thinks the generated tweets are not engaging enough.',
    tweets_too_long: 'The user thinks the generated tweets are too long.',
    wrong_segments: 'The user thinks wrong parts of the video were selected for clipping.',
    general: 'The user has general feedback about the AI video processing system.',
  };

  const prompt = `You are a prompt engineering assistant. A user submitted feedback about an AI video clipping system.

Category: ${category}
Context: ${categoryContext[category]}
User's raw feedback: "${rawText}"

Your job: Convert the user's raw feedback into ONE clear, concise, actionable instruction that can be added to an AI prompt. The instruction should:
- Be written in second person ("You must...", "Always...", "Never...")
- Be specific and unambiguous
- Be 1-2 sentences maximum
- Sound professional, not like a user complaint

Return ONLY the instruction text, nothing else.`;

  try {
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3.2',
        prompt,
        stream: false,
        options: { temperature: 0.3, num_ctx: 1024 },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama rephrase failed: ${response.statusText}`);
    }

    const data = await response.json();
    const refined = data.response?.trim();
    
    if (refined && refined.length > 5) {
      console.log(`[Feedback:AI] Rephrased: "${rawText}" → "${refined}"`);
      return refined;
    }
    throw new Error('Empty rephrase result');
  } catch (error) {
    // Fallback: use a template-based rephrase if Ollama is unavailable
    console.warn(`[Feedback:AI] Rephrase failed, using template fallback:`, error);
    return templateRephrase(category, rawText);
  }
}

/**
 * Template-based fallback if Ollama is unavailable for rephrasing.
 */
function templateRephrase(category: FeedbackCategory, rawText: string): string {
  const templates: Record<FeedbackCategory, string> = {
    clips_too_short: `Always ensure clips are long enough to contain a complete narrative arc. ${rawText ? 'Specifically: ' + rawText : ''}`,
    clips_too_long: `Keep clips concise and tightly edited. Remove any filler or dead air. ${rawText ? 'Specifically: ' + rawText : ''}`,
    bad_titles: `Titles must be specific to the actual content discussed, not generic clickbait. ${rawText ? 'Specifically: ' + rawText : ''}`,
    bad_context_overlays: `Context overlays must create genuine curiosity, not describe the scene. ${rawText ? 'Specifically: ' + rawText : ''}`,
    clips_cut_mid_sentence: `Never cut a clip in the middle of a sentence. Always end at natural sentence boundaries.`,
    tweets_boring: `Tweets must take a strong stance and provoke engagement. ${rawText ? 'Specifically: ' + rawText : ''}`,
    tweets_too_long: `Keep tweets punchy and under 200 characters. Brevity is key.`,
    wrong_segments: `Select the most impactful, emotionally charged segments. ${rawText ? 'Specifically: ' + rawText : ''}`,
    general: rawText || 'Follow the user\'s quality preferences more carefully.',
  };
  return templates[category];
}

// ============================================================
// Dynamic Params
// ============================================================

export async function getDynamicParams(): Promise<DynamicParams> {
  await ensureDir();
  try {
    const raw = await readFile(PARAMS_PATH, 'utf-8');
    return { ...DEFAULT_PARAMS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_PARAMS };
  }
}

async function saveDynamicParams(params: DynamicParams): Promise<void> {
  await ensureDir();
  await writeFile(PARAMS_PATH, JSON.stringify(params, null, 2), 'utf-8');
  console.log(`[Feedback:RuleEngine] Params updated:`, params);
}

// ============================================================
// Rule Engine — maps category → parameter adjustments
// ============================================================

async function applyFeedbackRules(category: FeedbackCategory): Promise<void> {
  const params = await getDynamicParams();

  switch (category) {
    case 'clips_too_short':
      params.minClipDuration = Math.min(params.minClipDuration + 5, 35);
      params.targetClipDuration = Math.min(params.targetClipDuration + 5, 55);
      console.log(`[RuleEngine] clips_too_short → minClipDuration=${params.minClipDuration}, target=${params.targetClipDuration}`);
      break;

    case 'clips_too_long':
      params.maxClipDuration = Math.max(params.maxClipDuration - 5, 30);
      params.targetClipDuration = Math.max(params.targetClipDuration - 5, 25);
      console.log(`[RuleEngine] clips_too_long → maxClipDuration=${params.maxClipDuration}, target=${params.targetClipDuration}`);
      break;

    case 'clips_cut_mid_sentence':
      params.sentenceSnapBuffer = Math.max(params.sentenceSnapBuffer - 1, 1);
      console.log(`[RuleEngine] clips_cut_mid_sentence → sentenceSnapBuffer=${params.sentenceSnapBuffer}`);
      break;

    case 'bad_titles':
      params.titleStyle = 'specific, descriptive, NOT generic clickbait — use concrete details from the content';
      console.log(`[RuleEngine] bad_titles → titleStyle updated`);
      break;

    case 'bad_context_overlays':
      params.extraPromptRules.push('Context overlays must be emotional, curiosity-driven hooks — NOT descriptions of the scene.');
      console.log(`[RuleEngine] bad_context_overlays → extra rule added`);
      break;

    case 'tweets_boring':
      params.tweetStyle = 'bold, controversial, opinionated — take a strong stance, use punchy language';
      console.log(`[RuleEngine] tweets_boring → tweetStyle updated`);
      break;

    case 'tweets_too_long':
      params.extraPromptRules.push('Tweets MUST be under 200 characters. Shorter is better.');
      console.log(`[RuleEngine] tweets_too_long → extra rule added`);
      break;

    case 'wrong_segments':
      params.extraPromptRules.push('Pick segments from VASTLY DIFFERENT parts of the video. Spread clips evenly across the timeline.');
      console.log(`[RuleEngine] wrong_segments → extra rule added`);
      break;

    case 'general':
      // Free-text only — no parameter changes, handled by prompt injection
      break;
  }

  await saveDynamicParams(params);
}
