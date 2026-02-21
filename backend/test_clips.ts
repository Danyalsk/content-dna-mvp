import { generateClips } from './src/services/ffmpeg';

async function run() {
  const mockClips = [
    {
      "title": "Find Out How Things Work",
      "startTime": 447.8,
      "endTime": 494.2,
      "contextOverlay": "How things actually work:"
    }
  ];
  const mockTranscription = {
    text: "Find out how things work",
    segments: []
  };
  
  try {
    const videoPath = '.tmp/content-dna/test_vid.mp4';
    console.log("Generating clips...");
    const clips = await generateClips(videoPath, mockClips, mockTranscription, console.log);
    console.log("Generated:", clips);
  } catch(e) {
    console.error("Error:", e);
  }
}
run();
