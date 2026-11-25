import http from 'node:http';
import path from 'node:path';
import express from 'express';
import { WebSocketServer } from 'ws';
import { transcriptionRoutes } from './routes.js';
import { handleTranscription } from './transcribe.js';

export function createServer(db) {
  const app = express();
  app.use(express.json({ limit: '200kb' }));
  app.use(express.static(path.join(import.meta.dirname, '..', 'public')));

  app.get('/api/health', async (req, res) => {
    const dbOk = await db.ping().then(() => true, () => false);
    res.json({ db: dbOk, gemini: Boolean(process.env.GEMINI_API_KEY) });
  });

  app.use('/api/transcriptions', transcriptionRoutes(db));

  app.use((err, req, res, next) => {
    const status = err.status ?? 500;
    if (status >= 500) console.error(err);
    res.status(status).json({ error: status < 500 ? err.message : 'Server error' });
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws/transcribe', maxPayload: 256 * 1024 });
  wss.on('connection', (client) => handleTranscription(client, db));

  return server;
}
