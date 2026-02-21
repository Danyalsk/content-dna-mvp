import type { TranscriptionResult } from './transcription';

export interface VideoClip {
  title: string;
  startTime: number;
  endTime: number;
  contextOverlay: string;
}

export interface ContentDNA {
  topic: string;
  twitterPosts: string[];
  clips: VideoClip[];
}

export async function extractContentDNA(transcription: TranscriptionResult, onProgress?: (msg: string) => void): Promise<ContentDNA> {
  const prompt = `You are an expert content strategist and video editor. Analyze the following video transcript with timestamps and extract its "Content DNA". Provide a JSON response with exactly three fields:
1. "topic": the main topic or thesis in under 5 words.
2. "twitterPosts": an array of strings. Each string should be a standalone, engaging Twitter (X) post (under 280 characters) derived from the video's core insights.
3. "clips": an array of the 2 most engaging, high-retention video clips. Each clip must be a JSON object containing:
    - "title": A catchy title for the clip.
    - "startTime": The exact start time in seconds (number). Take this from the segment timestamps.
    - "endTime": The exact end time in seconds (number). Take this from the segment timestamps.
    - "contextOverlay": A short, viral hook summarizing the clip (e.g. "Harvey Specter exposed:", "The truth about AI:", "Why you fail:").

CRITICAL RULE 1: The duration of the clip (endTime - startTime) MUST BE LESS THAN 60 SECONDS to fit YouTube Shorts limits. Absolutely do not exceed 59 seconds per clip.
CRITICAL RULE 2: You MUST return exactly 2 clips in the array. NEVER return an empty array.

MANDATORY JSON FORMAT TEMPLATE:
{
  "topic": "Example Topic",
  "twitterPosts": ["Tweet 1", "Tweet 2"],
  "clips": [
    {
      "title": "Example Clip Title",
      "startTime": 12.5,
      "endTime": 45.0,
      "contextOverlay": "The $100k plot revealed:"
    }
  ]
}

DO NOT include any Markdown formatting or extra text. ONLY return valid JSON matching the exact schema above.

Transcript Segments: """
${transcription.segments.map(s => `[${s.start.toFixed(1)}s - ${s.end.toFixed(1)}s] ${s.text}`).join('\n').substring(0, 25000)}
"""`;

  const schema = {
    type: "object",
    properties: {
      topic: { type: "string" },
      twitterPosts: { type: "array", items: { type: "string" } },
      clips: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            startTime: { type: "number" },
            endTime: { type: "number" },
            contextOverlay: { type: "string" }
          },
          required: ["title", "startTime", "endTime", "contextOverlay"]
        }
      }
    },
    required: ["topic", "twitterPosts", "clips"]
  };

  try {
    onProgress?.(`[Ollama] Sending transcript to local llama3.2 model...`);
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama3.2',
        prompt: prompt,
        stream: false,
        format: schema
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    onProgress?.(`[Ollama] DNA Extracted Successfully. Validating structure...`);
    const data = await response.json();
    const parsed = JSON.parse(data.response);

    // Validate Schema
    if (!parsed.topic || !Array.isArray(parsed.twitterPosts) || !Array.isArray(parsed.clips)) {
      console.error("Malformed AI Output:", parsed);
      throw new Error("Local LLM returned malformed JSON schema. Please try again.");
    }
    
    // Fallback if local 3B model ignores instructions and returns empty clips
    if (parsed.clips.length === 0) {
      console.warn("[Ollama] Model returned 0 clips. Falling back to default first 30 seconds hook.");
      parsed.clips.push({
        title: "Default Hook Extraction",
        startTime: 0,
        endTime: Math.min(30, transcription.segments[transcription.segments.length - 1]?.end || 30),
        contextOverlay: "The Truth:"
      });
    }

    // We no longer enforce a 15s minimum clip length. Let the AI decide the natural bounds.
    return parsed as ContentDNA;
  } catch (error: any) {
    onProgress?.(`[Ollama:error] Failed to extract DNA: ${error.message}`);
    console.error("Ollama Extraction error:", error);
    throw error;
  }
}
