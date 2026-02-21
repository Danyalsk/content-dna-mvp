import { Elysia, t } from 'elysia';
import { downloadVideo } from '../services/youtube';
import { transcribeAudio } from '../services/transcription';
import { extractContentDNA } from '../services/ollama';
import { generateClips } from '../services/ffmpeg';

export const videoRoutes = new Elysia({ prefix: '/api/video' })
  .get('/stream-url', ({ query, set }) => {
    set.headers['Content-Type'] = 'text/event-stream';
    set.headers['Cache-Control'] = 'no-cache';
    set.headers['Connection'] = 'keep-alive';
    set.headers['Access-Control-Allow-Origin'] = '*';

    const encoder = new TextEncoder();
    
    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: string, event?: string) => {
          let payload = '';
          if (event) payload += `event: ${event}\n`;
          payload += `data: ${data}\n\n`;
          controller.enqueue(encoder.encode(payload));
        };

        // Keep-alive heartbeat every 15 seconds
        const heartbeat = setInterval(() => {
          controller.enqueue(encoder.encode(': keepalive\n\n'));
        }, 15000);

        try {
          const url = query.url;
          const videoId = url.split('v=')[1]?.substring(0, 11) || `vid_${Date.now()}`;

          send(`[System] Initializing pipeline for: ${url}`);

          const videoPath = await downloadVideo(url, videoId, (msg) => send(msg));

          const transcription = await transcribeAudio(videoPath, (msg) => send(msg));

          const dna = await extractContentDNA(transcription, (msg) => send(msg));

          const clips = await generateClips(videoPath, dna.clips || [], transcription, (msg) => send(msg));

          const finalData = {
            success: true,
            data: {
              ...dna,
              generatedClips: clips
            },
            transcriptPreview: transcription.text.substring(0, 200) + "..."
          };

          send(JSON.stringify(finalData), 'complete');
          clearInterval(heartbeat);
          controller.close();

        } catch (error: any) {
          console.error("Pipeline Error:", error);
          send(error.message, 'error');
          clearInterval(heartbeat);
          controller.close();
        }
      },
      cancel() {
        // Handle client disconnects to stop processing if needed
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  }, {
    query: t.Object({
      url: t.String()
    })
  });
