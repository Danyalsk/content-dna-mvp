import { Elysia } from 'elysia';

export const healthRoutes = new Elysia({ prefix: '/health' })
  .get('/', () => {
    return {
      status: 'ok',
      message: 'Content DNA OS Backend is running smoothly.',
      timestamp: new Date().toISOString()
    };
  });
