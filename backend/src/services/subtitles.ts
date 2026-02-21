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
  // Extract all words that fall within the clip's timeframe
  const clipWords: TranscriptionWord[] = [];
  
  for (const segment of transcription.segments) {
    if (!segment.words) continue;
    
    for (const word of segment.words) {
      if (word.end >= clip.startTime && word.start <= clip.endTime) {
        clipWords.push({
          word: word.word,
          start: Math.max(0, word.start - clip.startTime),
          end: Math.max(0, word.end - clip.startTime)
        });
      }
    }
  }

  // Create standard ASS Header for a 9:16 video (1080x1920)
  // Default Style: Alignment=2 (Bottom Center), MarginV=400 (dynamic override per line).
  // Context Style: Alignment=8 (Top Center), MarginV=150, White text, Black box backing.
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

  // Inject the Context Overlay (Hook) if present. Displays for the first 3.5 seconds.
  if (clip.contextOverlay && clipWords.length > 0) {
    const clipDuration = clip.endTime - clip.startTime;
    const overlayDuration = Math.min(clipDuration, 3.5); // Cap at 3.5s or clip length
    const endTotal = formatAssTime(overlayDuration); 
    // Replace newlines/escapes to be safe in ASS
    const safeContext = clip.contextOverlay.replace(/\\n/g, '\\N');
    assContent += `Dialogue: 1,0:00:00.00,${endTotal},ContextStyle,,0,0,0,,${safeContext}\n`;
  }

  // Group words into chunks of ~3-5 words each for display
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
      
      const eventMarginV = isSplit ? "960" : "400"; // Dynamic MarginV override per word!
      assContent += `Dialogue: 0,${startT},${endT},Default,,0,0,${eventMarginV},,${dialogueText.trim()}\n`;
    }
  }

  await writeFile(outputPath, assContent, 'utf-8');
  return outputPath;
}
