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
  // Calculate total video duration from transcript
  const totalDuration = transcription.segments.length > 0 
    ? transcription.segments[transcription.segments.length - 1].end 
    : 60;

  const prompt = `You are the world's best viral video editor working at OpusClip. Your job is to find the 2 most VIRAL, ENGAGING moments from a long video and turn them into YouTube Shorts clips.

WHAT MAKES A VIRAL CLIP:
- A strong opinion or controversial take that triggers emotion
- A surprising revelation, confession, or unexpected twist
- High-energy storytelling with a clear beginning, middle, and end
- A self-contained narrative arc that makes sense WITHOUT the rest of the video
- A moment where the speaker drops a "golden nugget" of wisdom

WHAT IS NOT A VIRAL CLIP:
- Random filler conversation or small talk
- Introductions, greetings, or "hey guys welcome back"
- Segments that require prior context to understand
- Moments that are just 1-2 sentences long (these are NOT clips)

DURATION REQUIREMENTS:
- Each clip MUST be between 30 and 55 seconds long. This is NON-NEGOTIABLE.
- The startTime and endTime must span a FULL NARRATIVE ARC, not a single sentence.
- Example: if a great moment starts at segment [120.0s] and the insight concludes around [155.0s], set startTime=120.0 and endTime=155.0 (35 seconds).
- NEVER return a clip shorter than 30 seconds. If you do, you have FAILED.

The total video duration is ${totalDuration.toFixed(1)} seconds. Pick clips from DIFFERENT parts of the video for variety.

Analyze the transcript below and return a JSON object with:
1. "topic": the main topic in under 5 words
2. "twitterPosts": array of 3 engaging tweets (under 280 chars each)
3. "clips": array of exactly 2 clips, each with:
   - "title": a catchy, clickbait-worthy title
   - "startTime": start time in seconds (number, from the transcript timestamps)
   - "endTime": end time in seconds (number, from the transcript timestamps). MUST be at least 30 seconds after startTime.
   - "contextOverlay": A punchy, emotional hook that TEASES what's about to happen in the clip (3-8 words max). It must create curiosity and make the viewer NEED to watch.
      GOOD examples: "Mike impressing Harvey:", "The betrayal nobody expected:", "He said this to her face:", "Why he got fired:"
      BAD examples (DO NOT DO THIS): "Harvey and Mike are partners", "Two people talking", "Scene from the show" — these are boring descriptions, NOT hooks.

MANDATORY JSON FORMAT:
{
  "topic": "Success Mindset Secrets",
  "twitterPosts": ["Tweet 1", "Tweet 2", "Tweet 3"],
  "clips": [
    {
      "title": "The Moment Everything Changed",
      "startTime": 45.0,
      "endTime": 90.0,
      "contextOverlay": "Nobody talks about this:"
    },
    {
      "title": "Why Most People Stay Broke",
      "startTime": 250.0,
      "endTime": 295.0,
      "contextOverlay": "The harsh truth:"
    }
  ]
}

ONLY return valid JSON. No markdown, no extra text.

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
        format: schema,
        options: {
          temperature: 0.4,
          num_ctx: 8192
        }
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
      console.warn("[Ollama] Model returned 0 clips. Falling back to smart defaults.");
      const mid = totalDuration / 2;
      parsed.clips.push(
        {
          title: "Key Insight #1",
          startTime: Math.max(0, totalDuration * 0.1),
          endTime: Math.min(totalDuration, totalDuration * 0.1 + 40),
          contextOverlay: "Watch this:"
        },
        {
          title: "Key Insight #2",
          startTime: Math.max(0, mid),
          endTime: Math.min(totalDuration, mid + 40),
          contextOverlay: "The truth:"
        }
      );
    }

    // ========== POST-PROCESSING: Fix clips that are too short ==========
    // The local 3B model often ignores duration rules. We MUST enforce them here.
    const MIN_CLIP_DURATION = 15; // Absolute minimum we'll accept
    const TARGET_CLIP_DURATION = 40; // What we'll expand short clips to
    
    for (let i = 0; i < parsed.clips.length; i++) {
      const clip = parsed.clips[i];
      const duration = clip.endTime - clip.startTime;
      
      if (duration < MIN_CLIP_DURATION) {
        console.warn(`[Ollama:PostProcess] Clip "${clip.title}" is only ${duration.toFixed(1)}s — expanding to ${TARGET_CLIP_DURATION}s`);
        onProgress?.(`[Ollama:PostProcess] Clip "${clip.title}" was ${duration.toFixed(1)}s — expanding to ~${TARGET_CLIP_DURATION}s`);
        
        let newEnd = clip.startTime + TARGET_CLIP_DURATION;
        let newStart = clip.startTime;
        
        if (newEnd > totalDuration) {
          newEnd = Math.min(totalDuration, clip.endTime + 5);
          newStart = Math.max(0, newEnd - TARGET_CLIP_DURATION);
        }
        
        parsed.clips[i].startTime = Math.round(newStart * 10) / 10;
        parsed.clips[i].endTime = Math.round(newEnd * 10) / 10;
        
        console.log(`[Ollama:PostProcess] Clip "${clip.title}" expanded: ${parsed.clips[i].startTime}s - ${parsed.clips[i].endTime}s`);
      }
      
      // Cap clips that are too long (>59s)
      if (parsed.clips[i].endTime - parsed.clips[i].startTime > 59) {
        parsed.clips[i].endTime = parsed.clips[i].startTime + 55;
        console.warn(`[Ollama:PostProcess] Clip "${clip.title}" was too long — capped to 55s`);
      }
    }

    // ========== POST-PROCESSING: Snap to sentence boundaries ==========
    // Ensures clips don't cut mid-sentence. Find the nearest segment boundary.
    const segments = transcription.segments;
    if (segments.length > 0) {
      for (let i = 0; i < parsed.clips.length; i++) {
        const clip = parsed.clips[i];
        
        // Snap startTime to the start of the nearest segment that begins at or before clip.startTime
        let bestStartSeg = segments[0];
        for (const seg of segments) {
          if (seg.start <= clip.startTime && seg.start >= bestStartSeg.start) {
            bestStartSeg = seg;
          }
        }
        // Only snap if it doesn't drastically change the clip (within 5 seconds)
        if (Math.abs(bestStartSeg.start - clip.startTime) < 5) {
          parsed.clips[i].startTime = bestStartSeg.start;
        }
        
        // Snap endTime to the end of the nearest segment that ends at or after clip.endTime
        let bestEndSeg = segments[segments.length - 1];
        for (const seg of segments) {
          if (seg.end >= clip.endTime && seg.end <= bestEndSeg.end) {
            bestEndSeg = seg;
          }
        }
        if (Math.abs(bestEndSeg.end - clip.endTime) < 5) {
          parsed.clips[i].endTime = bestEndSeg.end;
        }
        
        // Re-enforce duration cap after snapping
        if (parsed.clips[i].endTime - parsed.clips[i].startTime > 59) {
          parsed.clips[i].endTime = parsed.clips[i].startTime + 55;
        }
        
        const finalDuration = parsed.clips[i].endTime - parsed.clips[i].startTime;
        console.log(`[Ollama:PostProcess] Clip "${clip.title}" snapped to sentences: ${parsed.clips[i].startTime.toFixed(1)}s - ${parsed.clips[i].endTime.toFixed(1)}s (${finalDuration.toFixed(1)}s)`);
        onProgress?.(`[Ollama:PostProcess] Clip "${clip.title}" aligned to sentence boundaries (${finalDuration.toFixed(0)}s)`);
      }
    }

    return parsed as ContentDNA;
  } catch (error: any) {
    onProgress?.(`[Ollama:error] Failed to extract DNA: ${error.message}`);
    console.error("Ollama Extraction error:", error);
    throw error;
  }
}
