import { extractContentDNA } from './src/services/ollama';

async function run() {
  const fakeTranscript = {
    text: "Welcome to this incredible video about artificial intelligence. AI is changing the world. It is replacing jobs but also creating new ones. In the future, we will see robots doing everything.",
    segments: [
      { start: 0, end: 5, text: "Welcome to this incredible video about artificial intelligence." },
      { start: 5, end: 10, text: "AI is changing the world." },
      { start: 10, end: 15, text: "It is replacing jobs but also creating new ones." },
      { start: 15, end: 20, text: "In the future, we will see robots doing everything." }
    ]
  };

  try {
    const dna = await extractContentDNA(fakeTranscript, console.log);
    console.log("RESULT:", JSON.stringify(dna, null, 2));
  } catch (err) {
    console.error("ERROR:", err);
  }
}

run();
