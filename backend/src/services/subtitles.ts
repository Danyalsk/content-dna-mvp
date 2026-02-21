import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { TranscriptionResult, TranscriptionWord } from './transcription';
import type { VideoClip } from './ollama';
import type { SceneLayout } from './ffmpeg';

// Helper to format seconds to ASS timestamp format (H:MM:SS.cs)
function formatAssTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const cs = Math.floor((seconds % 1) * 100); // centiseconds
  
  return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`;
}

export async function generateSubtitles(clip: VideoClip, transcription: TranscriptionResult, outputPath: string, scenes: SceneLayout[] = []): Promise<string> {
  const clipDuration = clip.endTime - clip.startTime;

  // =====================================================================
  // STEP 1: Extract words that fall within the clip's timeframe.
  //         Supports BOTH word-level AND segment-level fallback.
  // =====================================================================
  const clipWords: TranscriptionWord[] = [];
  
  for (const segment of transcription.segments) {
    // Check if this segment overlaps with the clip at all
    if (segment.end < clip.startTime || segment.start > clip.endTime) continue;

    if (segment.words && segment.words.length > 0) {
      // PREFERRED: Use word-level timestamps for karaoke highlighting
      for (const word of segment.words) {
        if (word.end >= clip.startTime && word.start <= clip.endTime) {
          clipWords.push({
            word: word.word,
            start: Math.max(0, word.start - clip.startTime),
            end: Math.max(0, word.end - clip.startTime)
          });
        }
      }
    } else if (segment.text && segment.text.trim().length > 0) {
      // FALLBACK: No word-level timestamps — split segment text into synthetic words.
      // Distribute timing evenly across words within the segment's time range.
      const words = segment.text.trim().split(/\s+/);
      const segStart = Math.max(0, segment.start - clip.startTime);
      const segEnd = Math.max(0, segment.end - clip.startTime);
      const segDuration = segEnd - segStart;
      
      if (words.length > 0 && segDuration > 0) {
        const wordDuration = segDuration / words.length;
        for (let w = 0; w < words.length; w++) {
          clipWords.push({
            word: words[w],
            start: segStart + (w * wordDuration),
            end: segStart + ((w + 1) * wordDuration)
          });
        }
      }
    }
  }

  console.log(`[Subtitles] Found ${clipWords.length} words for clip "${clip.title}" (${clip.startTime.toFixed(1)}s - ${clip.endTime.toFixed(1)}s)`);

  // =====================================================================
  // STEP 2: Build the ASS file header with styles
  // =====================================================================
  let assContent = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,96,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,6,4,2,40,40,400,1
Style: ContextStyle,Arial,80,&H00FFFFFF,&H000000FF,&H00000000,&H99000000,-1,0,0,0,100,100,0,0,3,15,0,8,40,40,150,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  // =====================================================================
  // STEP 3: ALWAYS inject the Context Overlay (Hook) — NOT gated on clipWords!
  //         This is the "scroll stopper" that gives viewers context in the first 3.5s.
  // =====================================================================
  if (clip.contextOverlay) {
    const overlayDuration = Math.min(clipDuration, 3.5);
    const endTotal = formatAssTime(overlayDuration); 
    const safeContext = clip.contextOverlay.replace(/\\n/g, '\\N');
    assContent += `Dialogue: 1,0:00:00.00,${endTotal},ContextStyle,,0,0,0,,${safeContext}\n`;
    console.log(`[Subtitles] Context overlay injected: "${safeContext}" (0 - ${overlayDuration.toFixed(1)}s)`);
  }

  // =====================================================================
  // STEP 4: Generate karaoke-style word-by-word subtitle events
  // =====================================================================
  const WORDS_PER_CHUNK = 4;
  for (let i = 0; i < clipWords.length; i += WORDS_PER_CHUNK) {
    const chunk = clipWords.slice(i, i + WORDS_PER_CHUNK);
    if (chunk.length === 0) continue;

    for (let j = 0; j < chunk.length; j++) {
      const activeWord = chunk[j];
      
      const startT = formatAssTime(activeWord.start);
      const nextWord = chunk[j + 1];
      let endSeconds = nextWord ? nextWord.start : chunk[chunk.length - 1].end;
      
      if (endSeconds <= activeWord.start) endSeconds = activeWord.end;
      const endT = formatAssTime(endSeconds);

      let dialogueText = '';
      for (let k = 0; k < chunk.length; k++) {
        const w = chunk[k];
        const upperWord = w.word.toUpperCase();
        if (k === j) {
          dialogueText += `{\\c&H00FF00FF&}{\\b1}${upperWord}{\\b0}{\\c&H00FFFFFF&} `;
        } else {
          dialogueText += `${upperWord} `;
        }
      }

      // Determine which layout scene this word falls into
      let isSplit = false;
      for (const scene of scenes) {
        if (activeWord.start >= scene.start && activeWord.start <= scene.end) {
          isSplit = scene.layout === 'split';
          break;
        }
      }
      
      const eventMarginV = isSplit ? "960" : "400";
      assContent += `Dialogue: 0,${startT},${endT},Default,,0,0,${eventMarginV},,${dialogueText.trim()}\n`;
    }
  }

  await writeFile(outputPath, assContent, 'utf-8');
  console.log(`[Subtitles] ASS file written: ${outputPath} (${clipWords.length} words, context: ${!!clip.contextOverlay})`);
  return outputPath;
}
