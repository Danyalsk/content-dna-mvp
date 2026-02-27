import { Elysia, t } from 'elysia';
import { downloadVideo } from '../services/youtube';
import { transcribeAudio } from '../services/transcription';
import { extractContentDNA } from '../services/ollama';
import { generateClips } from '../services/ffmpeg';
import { saveClipRating } from '../services/ratings';
import { saveFeedback, getAllFeedback, type FeedbackCategory } from '../services/feedback';

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
  })
  .post('/rate-clip', async ({ body }) => {
    try {
      await saveClipRating(
        body.videoId,
        body.videoUrl || '',
        body.topic || '',
        {
          videoId: body.videoId,
          clipTitle: body.clipTitle,
          clipUrl: body.clipUrl || '',
          startTime: body.startTime,
          endTime: body.endTime,
          contextOverlay: body.contextOverlay || '',
          rating: body.rating,
          approved: body.approved,
          ratedAt: new Date().toISOString()
        }
      );
      return { success: true, message: 'Rating saved!' };
    } catch (error: any) {
      console.error('[Ratings] Error saving:', error);
      return { success: false, message: error.message };
    }
  }, {
    body: t.Object({
      videoId: t.String(),
      videoUrl: t.Optional(t.String()),
      topic: t.Optional(t.String()),
      clipTitle: t.String(),
      clipUrl: t.Optional(t.String()),
      startTime: t.Number(),
      endTime: t.Number(),
      contextOverlay: t.Optional(t.String()),
      rating: t.Number(),
      approved: t.Boolean()
    })
  })
  // ============================================================
  // Feedback System Routes
  // ============================================================
  .post('/submit-feedback', async ({ body }) => {
    try {
      await saveFeedback({
        id: `fb_${Date.now()}`,
        category: body.category as FeedbackCategory,
        feedbackText: body.feedbackText,
        refinedInstruction: '',  // Will be filled by AI rephrase in saveFeedback
        createdAt: new Date().toISOString(),
      });
      return { success: true, message: 'Feedback saved! Your preferences will be applied on the next video run.' };
    } catch (error: any) {
      console.error('[Feedback] Error saving:', error);
      return { success: false, message: error.message };
    }
  }, {
    body: t.Object({
      category: t.String(),
      feedbackText: t.String(),
    })
  })
  .get('/feedback-history', async () => {
    try {
      const entries = await getAllFeedback();
      return { success: true, feedback: entries.slice(-20).reverse() };
    } catch (error: any) {
      console.error('[Feedback] Error loading history:', error);
      return { success: false, feedback: [], message: error.message };
    }
  });

