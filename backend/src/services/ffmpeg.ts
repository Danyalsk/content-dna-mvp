import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { generateSubtitles } from './subtitles';
import type { VideoClip } from './ollama';
import type { TranscriptionResult } from './transcription';

const PYTHON_SCRIPT = join(process.cwd(), 'src', 'scripts', 'smart_crop.py');
const PUBLIC_CLIPS = join(process.cwd(), 'public', 'clips');

export interface SceneLayout {
   layout: 'single' | 'split';
   start: number;
   end: number;
   x?: number;        // if single
   left_x?: number;   // if split
   right_x?: number;  // if split
}

interface CropData {
  crop_width: number;
  crop_height: number;
  face_found: boolean;
  scenes: SceneLayout[];
}

export async function ensureClipsDir() {
  try {
    await stat(PUBLIC_CLIPS);
  } catch {
    await mkdir(PUBLIC_CLIPS, { recursive: true });
  }
}

async function getSmartCrop(videoPath: string, start: number, end: number): Promise<CropData> {
  return new Promise((resolve, reject) => {
    const py = spawn('python3', [PYTHON_SCRIPT, videoPath, start.toString(), end.toString()]);
    let output = '';
    
    py.stdout.on('data', data => { output += data.toString(); });
    py.stderr.on('data', data => { 
      console.error(`[Python:Error] ${data.toString()}`); 
    });
    
    py.on('close', code => {
      if (code === 0) {
        try {
          const jsonStr = output.substring(output.indexOf('{'));
          resolve(JSON.parse(jsonStr));
        } catch (e) {
          console.error("Smart Crop Parse Error", output);
          reject(e);
        }
      } else {
        reject(new Error(`smart_crop.py exited with ${code}`));
      }
    });
  });
}

export interface GeneratedClip extends VideoClip {
  url: string;
  layout: 'single' | 'split';
}

export async function generateClips(videoPath: string, clips: VideoClip[], transcription: TranscriptionResult, onProgress?: (msg: string) => void): Promise<GeneratedClip[]> {
  await ensureClipsDir();
  const generated: GeneratedClip[] = [];

  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i];
    onProgress?.(`[FFmpeg] Processing clip ${i+1}/${clips.length}: "${clip.title}"`);
    console.log(`[FFmpeg] Processing clip ${i+1}/${clips.length}: "${clip.title}"`);
    
    try {
      // 1. Get smart crop coordinates
      onProgress?.(`[OpenCV] Tracking primary face for clip ${i+1}...`);
      const cropData = await getSmartCrop(videoPath, clip.startTime, clip.endTime);
      console.log(`[FFmpeg] Crop Data for "${clip.title}":`, cropData);

      // Clean title for filesystem
      const safeTitle = clip.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const timestamp = Date.now();
      const outputFilename = `clip_${timestamp}_${safeTitle}.mp4`;
      const outputPath = join(PUBLIC_CLIPS, outputFilename);
      const relativeAssFilename = `public/clips/sub_${timestamp}.ass`;
      const assPath = join(process.cwd(), relativeAssFilename);

      // Extract median tracking data from scenes to prevent flickering
      const singleScenes = cropData.scenes.filter(s => s.layout === 'single');
      const splitScenes = cropData.scenes.filter(s => s.layout === 'split');
      
      let globalSingleX = 1920/2 - cropData.crop_width/2; // fallback center
      if (singleScenes.length > 0) { globalSingleX = singleScenes[0].x || globalSingleX; }
      
      let globalLeftX = 1920 * 0.25 - 1080/2; // fallback
      let globalRightX = 1920 * 0.75 - 1080/2; // fallback
      if (splitScenes.length > 0) {
          globalLeftX = splitScenes[0].left_x || globalLeftX;
          globalRightX = splitScenes[0].right_x || globalRightX;
      }

      // Generate Karaoke Subtitles (passing the full layout timeline so text can shift!)
      onProgress?.(`[Subtitles] Generating karaoke .ass file...`);
      await generateSubtitles(clip, transcription, assPath, cropData.scenes);
      
      const safeAssPath = assPath.replace(/\\/g, '\\\\').replace(/:/g, '\\:');
      
      let filter = "";
      
      // Calculate audio fade parameters
      const clipDuration = clip.endTime - clip.startTime;
      const fadeOutStart = Math.max(0, clipDuration - 0.3);
      const audioFilter = `[0:a]afade=t=in:d=0.3,afade=t=out:st=${fadeOutStart.toFixed(2)}:d=0.3[a]`;
      
      if (splitScenes.length > 0) {
         // --- DYNAMIC SWITCHING SCRIPT ---
         onProgress?.(`[FFmpeg] Cut detected! Switching dynamically between Single and Split Views.`);
         
         const singleDef = `[0:v]crop=${cropData.crop_width}:${cropData.crop_height}:${globalSingleX}:0,scale=1080:1920[single_bg]`;
         const splitDef = `[0:v]crop=1080:1080:${globalLeftX}:0[top_part];[0:v]crop=1080:1080:${globalRightX}:0[bottom_part];[top_part][bottom_part]vstack[stacked];[stacked]crop=1080:1920[split_fg]`;
         const enableExprs = splitScenes.map(s => `between(t,${s.start},${s.end})`).join('+');
         
         filter = `${singleDef};${splitDef};[single_bg][split_fg]overlay=enable='${enableExprs}'[composite];[composite]ass=filename='${safeAssPath}'[v];${audioFilter}`;
      } else {
         // --- CONTINUOUS SINGLE SPEAKER ---
         filter = `[0:v]crop=${cropData.crop_width}:${cropData.crop_height}:${globalSingleX}:0,scale=1080:1920[cropped];[cropped]ass=filename='${safeAssPath}'[v];${audioFilter}`;
      }

      const filterGraphFilename = `filter_${timestamp}.txt`;
      const filterGraphPath = join(PUBLIC_CLIPS, filterGraphFilename);
      await writeFile(filterGraphPath, filter, 'utf-8');

      onProgress?.(`[FFmpeg] Cutting and cropping video segment using filter script...`);
      await new Promise<void>((resolve, reject) => {
        const ffmpegProcess = spawn('ffmpeg', [
          '-y',
          '-ss', clip.startTime.toString(),   // BEFORE -i: input-level seek, resets timestamps to 0
          '-i', videoPath,
          '-t', clipDuration.toString(),       // duration, not absolute end time
          '-filter_complex_script', filterGraphPath,
          '-map', '[v]',
          '-map', '[a]',                       // map audio from filter graph, not raw stream
          '-c:v', 'libx264',
          '-preset', 'fast',
          '-c:a', 'aac',
          '-b:a', '128k',
          outputPath
        ]);

        ffmpegProcess.stderr.on('data', (data) => {
           const msg = data.toString().trim();
           console.log(`[FFmpeg Trace] ${msg}`);
           
           if (msg.includes('time=')) {
              const timeMatch = msg.match(/time=(\d{2}:\d{2}:\d{2}\.\d{2})/);
              if (timeMatch) onProgress?.(`[FFmpeg:encoding] Current timestamp: ${timeMatch[1]}`);
           }
        });

        ffmpegProcess.on('close', code => {
          if (code === 0) {
            onProgress?.(`[FFmpeg] Clip ${i+1} saved.`);
            resolve();
          } else {
            onProgress?.(`[FFmpeg:error] exited with code ${code}`);
            reject(new Error(`ffmpeg exited with code ${code}`));
          }
        });
      });

      generated.push({
        ...clip,
        url: `/clips/${outputFilename}`,
        layout: splitScenes.length > 0 ? 'split' : 'single'
      });
      
    } catch (e: any) {
      onProgress?.(`[FFmpeg:error] Failed to generate clip "${clip.title}": ${e.message}`);
      console.error(`[FFmpeg] Failed to generate clip "${clip.title}":`, e);
      throw e;
    }
  }

  return generated;
}
