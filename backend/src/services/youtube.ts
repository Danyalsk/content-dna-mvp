import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { mkdir, stat } from 'node:fs/promises';

const TMP_DIR = join(process.cwd(), '.tmp', 'content-dna');

export async function ensureTmpDir() {
  try {
    await stat(TMP_DIR);
  } catch {
    await mkdir(TMP_DIR, { recursive: true });
  }
  return TMP_DIR;
}

export async function downloadVideo(url: string, videoId: string, onProgress?: (msg: string) => void): Promise<string> {
  const tmpDir = await ensureTmpDir();
  const outputPath = join(tmpDir, `${videoId}.mp4`);

  return new Promise((resolve, reject) => {
    onProgress?.(`[yt-dlp] Starting download for ${url}...`);

    // We now download the full video for face tracking and clipping
    const ytProcess = spawn('yt-dlp', [
      '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
      '--merge-output-format', 'mp4',
      '-o', outputPath,
      url
    ]);

    ytProcess.stdout.on('data', (data) => {
      const msg = data.toString().trim();
      if (msg) onProgress?.(`[yt-dlp] ${msg}`);
    });

    ytProcess.stderr.on('data', (data) => {
      const msg = data.toString().trim();
      if (msg) onProgress?.(`[yt-dlp:err] ${msg}`);
    });

    ytProcess.on('close', (code) => {
      if (code === 0) {
        onProgress?.(`[yt-dlp] Download complete.`);
        resolve(outputPath);
      } else {
        const errorMsg = `yt-dlp process exited with code ${code}`;
        onProgress?.(`[yt-dlp:error] ${errorMsg}`);
        reject(new Error(errorMsg));
      }
    });

    ytProcess.on('error', (err) => {
      onProgress?.(`[yt-dlp:error] ${err.message}`);
      reject(err);
    });
  });
}
