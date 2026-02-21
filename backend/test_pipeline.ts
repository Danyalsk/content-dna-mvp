import { downloadVideo } from './src/services/youtube';
import { transcribeAudio } from './src/services/transcription';
import { extractContentDNA } from './src/services/ollama';

async function run() {
  try {
    const url = 'https://youtu.be/OyKIbaSk2s4';
    console.log("Downloading...");
    const videoPath = await downloadVideo(url, 'test_vid');
    console.log("Video path:", videoPath);
    
    console.log("Transcribing...");
    const transcription = await transcribeAudio(videoPath);
    console.log("Transcription length:", transcription.text.length);
    console.log("Transcript preview:", transcription.text.substring(0, 200));
    
    console.log("Extracting DNA...");
    const dna = await extractContentDNA(transcription);
    console.log("DNA Result:", JSON.stringify(dna, null, 2));

  } catch(e) {
    console.error("Error:", e);
  }
}
run();
