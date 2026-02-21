import { Elysia } from "elysia";
import { healthRoutes } from "./routes/health";
import { videoRoutes } from "./routes/video";

const app = new Elysia()
  // Native CORS bypass to prevent @elysiajs/cors from destroying stream Responses
  .onRequest(({ set }) => {
    set.headers['Access-Control-Allow-Origin'] = '*';
    set.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
    set.headers['Access-Control-Allow-Headers'] = 'Origin, X-Requested-With, Content-Type, Accept';
  })
  .options('*', ({ set }) => {
    set.status = 204;
    return '';
  })
  .use(healthRoutes)
  .use(videoRoutes)
  .get("/clips/:filename", ({ params: { filename }, set }) => {
    const file = Bun.file(`public/clips/${filename}`);
    if (file.size === 0) {
      set.status = 404;
      return "Not Found";
    }
    return file;
  })
  .onError(({ code, error, request }) => {
    console.error(`[Elysia Global Error] ${code} at ${request.url}:`, error);
  })
  .listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
