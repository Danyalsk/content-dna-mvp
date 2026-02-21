import { spawn } from 'node:child_process';
import { join } from 'node:path';

const SCRIPT_PATH = join(process.cwd(), 'src', 'scripts', 'run_whisper.py');

export interface TranscriptionWord {
  word: string;
  start: number;
  end: number;
  speaker?: string;
}

export interface TranscriptionSegment {
  start: number;
  end: number;
  text: string;
  speaker?: string;
  words?: TranscriptionWord[];
}

export interface TranscriptionResult {
  text: string;
  segments: TranscriptionSegment[];
}

export async function transcribeAudio(audioPath: string, onProgress?: (msg: string) => void): Promise<TranscriptionResult> {
  return new Promise((resolve, reject) => {
    onProgress?.(`[Whisper] Starting local transcription...`);
    const pythonProcess = spawn('python3', [SCRIPT_PATH, audioPath]);

    let output = '';
    let errorOutput = '';

    pythonProcess.stdout.on('data', (data) => {
      const msg = data.toString();
      output += msg;
      // Emit line by line if possible, but python stdout is usually buffered.
    });

    pythonProcess.stderr.on('data', (data) => {
      const msg = data.toString();
      errorOutput += msg;
      // Whisper tends to spit progress/warnings into stderr
      const cleanMsg = msg.trim();
      if (cleanMsg) {
        // filter out massive verbose dumps if we want, but for now send it
        onProgress?.(`[Whisper] ${cleanMsg}`);
      }
    });

    pythonProcess.on('close', (code) => {
      if (code === 0) {
        try {
          // Find the JSON block. Sometimes Whisper outputs warnings to stdout, so we extract the JSON object.
          const jsonStr = output.substring(output.indexOf('{'));
          const result = JSON.parse(jsonStr) as TranscriptionResult;
          onProgress?.(`[Whisper] Transcription complete.`);
          resolve(result);
        } catch (err) {
          console.error("Parse Error:", err, "Raw Output:", output);
          onProgress?.(`[Whisper:error] Failed to parse JSON result.`);
          reject(new Error("Failed to parse transcription output as JSON"));
        }
      } else {
        console.error("Whisper Error:", errorOutput);
        onProgress?.(`[Whisper:error] Exited with code ${code}`);
        reject(new Error(`Whisper process exited with code ${code}`));
      }
    });

    pythonProcess.on('error', (err) => {
      onProgress?.(`[Whisper:error] ${err.message}`);
      reject(err);
    });
  });
}
