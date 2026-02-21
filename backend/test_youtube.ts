import { downloadVideo } from './src/services/youtube';
import { transcribeAudio } from './src/services/transcription';
import { extractContentDNA } from './src/services/ollama';
import { generateClips } from './src/services/ffmpeg';

async function runPipeline() {
  const url = 'https://youtu.be/SfSr5WC4bk4?si=M6OUgjf5fQcQZsTb';
  const videoId = 'SfSr5WC4bk4';
  
  const onProgress = (msg: string) => {
    console.log(`[Progress] ${msg}`);
  };

  try {
    console.log(`[System] Initializing Split-Screen pipeline for: ${url}`);
    
    // 1. Download
    const videoPath = await downloadVideo(url, videoId, onProgress);
    console.log(`[Result] Downloaded to: ${videoPath}`);

    // 2. Transcribe
    const transcription = await transcribeAudio(videoPath, onProgress);
    console.log(`[Result] Transcription completed. Length: ${transcription.text.length}`);

    // 3. Extract DNA
    const dna = await extractContentDNA(transcription, onProgress);
    console.log(`[Result] DNA Extracted. Clips identified: ${dna.clips?.length || 0}`);

    // 4. Generate Clips
    if (dna.clips && dna.clips.length > 0) {
      const clips = await generateClips(videoPath, dna.clips, transcription, onProgress);
      console.log(`[Success] Pipeline finished successfully. Generated ${clips.length} clips.`);
      console.log(JSON.stringify(clips, null, 2));
    } else {
      console.log(`[Warning] No clips were identified by the AI.`);
    }

  } catch (error) {
    console.error("Pipeline Error:", error);
  }
}

runPipeline();
