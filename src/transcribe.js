import WebSocket from 'ws';
import { connectGemini } from './gemini.js';
import { detectLanguage, makeTitle } from './text.js';

const LANGUAGES = { auto: [], 'hi-en': ['hi-IN', 'en-IN'], hi: ['hi-IN'], en: ['en-IN'] };
const MAX_SESSION_MS = 9.5 * 60 * 1000;
const FLUSH_WAIT_MS = 1500;

export function handleTranscription(client, db) {
  const reply = (message) => client.readyState === WebSocket.OPEN && client.send(JSON.stringify(message));
  const parts = [];
  let gemini = null;
  let ready = false;
  let saved = false;
  let startedAt = 0;
  let interim = '';
  let timer;

  function start(language) {
    if (gemini) return;
    if (!process.env.GEMINI_API_KEY) return reply({ type: 'error', message: 'GEMINI_API_KEY is not set on the server' });

    gemini = connectGemini({
      languageCodes: LANGUAGES[language] ?? [],
      onReady: () => {
        ready = true;
        startedAt = Date.now();
        timer = setTimeout(stop, MAX_SESSION_MS);
        reply({ type: 'ready' });
      },
      onInterim: (text) => {
        interim = text;
        reply({ type: 'interim', text });
      },
      onFinal: (text) => {
        interim = '';
        parts.push(text.trim());
        reply({ type: 'final', text: text.trim() });
      },
      onClose: (reason) => {
        if (saved) return;
        if (startedAt) return save();
        saved = true;
        reply({ type: 'error', message: `Could not connect to Gemini (${reason})` });
      },
    });
  }

  function stop() {
    clearTimeout(timer);
    if (!ready) return save();
    ready = false;
    gemini.end();
    timer = setTimeout(save, FLUSH_WAIT_MS);
  }

  async function save() {
    if (saved) return;
    saved = true;
    ready = false;
    clearTimeout(timer);
    gemini?.close();

    const text = [...parts, interim].join(' ').replace(/\s+/g, ' ').trim();
    if (!text) return reply({ type: 'saved', transcription: null });

    try {
      const transcription = await db.create({
        title: makeTitle(text),
        text,
        language: detectLanguage(text),
        durationMs: Date.now() - startedAt,
      });
      reply({ type: 'saved', transcription });
    } catch (err) {
      console.error('Save failed:', err);
      reply({ type: 'error', message: 'Could not save transcription' });
    }
  }

  client.on('message', (data, isBinary) => {
    if (isBinary) return ready && gemini.sendAudio(data);

    let message;
    try {
      message = JSON.parse(data);
    } catch {
      return;
    }
    if (message.type === 'start') start(message.language);
    if (message.type === 'stop') stop();
  });

  client.on('close', () => (startedAt ? save() : gemini?.close()));
}
