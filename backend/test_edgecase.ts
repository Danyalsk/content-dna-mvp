import { generateClips } from './src/services/ffmpeg';
async function run() {
  try {
    const clips = await generateClips("dummy.mp4", [], { text: "", segments: [] });
    console.log("Empty Output:", clips);
  } catch (e) {
    console.error("Error:", e);
  }
}
run();
