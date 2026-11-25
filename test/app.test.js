import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { execSync } from 'node:child_process';
import WebSocket, { WebSocketServer } from 'ws';
import { createPrismaClient, createDb } from '../src/db.js';
import { createServer } from '../src/app.js';

let server, baseUrl, fakeGemini, prisma;

const request = async (path, method = 'GET', body) => {
  const res = await fetch(baseUrl + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body && JSON.stringify(body),
  });
  return { status: res.status, body: res.status === 204 ? null : await res.json() };
};

before(async () => {
  fakeGemini = new WebSocketServer({ port: 0 });
  fakeGemini.on('connection', (ws) => {
    const reply = (message) => ws.send(JSON.stringify(message));
    ws.on('message', (data) => {
      const message = JSON.parse(data);
      if (message.setup) reply({ setupComplete: {} });
      if (message.realtimeInput?.audio) reply({ serverContent: { interimInputTranscription: { text: 'kal ki' } } });
      if (message.realtimeInput?.audioStreamEnd) reply({ serverContent: { inputTranscription: { text: 'Kal ki meeting 10 बजे है' } } });
    });
  });
  process.env.GEMINI_URL = `ws://localhost:${fakeGemini.address().port}`;
  process.env.GEMINI_API_KEY = 'test-key';

  // Tests need their own database, because every run starts by emptying the table
  const testDbUrl = process.env.TEST_DATABASE_URL;
  if (!testDbUrl?.includes('test')) {
    throw new Error('Set TEST_DATABASE_URL to a test database (its name must contain "test")');
  }
  execSync('npx prisma migrate deploy', { env: { ...process.env, DATABASE_URL: testDbUrl }, stdio: 'pipe' });

  prisma = createPrismaClient(testDbUrl);
  await prisma.transcription.deleteMany();

  server = createServer(createDb(prisma)).listen(0);
  await once(server, 'listening');
  baseUrl = `http://localhost:${server.address().port}`;
});

after(async () => {
  server.close();
  fakeGemini.close();
  await prisma.$disconnect();
});

test('CRUD on transcriptions', async () => {
  const created = await request('/api/transcriptions', 'POST', { text: 'Hello दुनिया' });
  assert.equal(created.status, 201);
  assert.equal(created.body.title, 'Hello दुनिया');

  const id = created.body.id;
  assert.equal((await request(`/api/transcriptions/${id}`)).body.text, 'Hello दुनिया');

  const updated = await request(`/api/transcriptions/${id}`, 'PATCH', { title: 'Greeting' });
  assert.equal(updated.body.title, 'Greeting');

  const found = await request('/api/transcriptions?q=greet');
  assert.equal(found.body.length, 1);

  assert.equal((await request(`/api/transcriptions/${id}`, 'DELETE')).status, 204);
  assert.equal((await request(`/api/transcriptions/${id}`)).status, 404);
  assert.equal((await request(`/api/transcriptions/${id}`, 'PATCH', { title: 'Gone' })).status, 404);
  assert.equal((await request(`/api/transcriptions/${id}`, 'DELETE')).status, 404);
});

test('rejects invalid input', async () => {
  assert.equal((await request('/api/transcriptions', 'POST', { text: '  ' })).status, 400);
  assert.equal((await request('/api/transcriptions/abc')).status, 400);
  assert.equal((await request('/api/transcriptions/1', 'PATCH', {})).status, 400);
});

test('live transcription streams text and saves it', async () => {
  const client = new WebSocket(`${baseUrl.replace('http', 'ws')}/ws/transcribe`);
  const messages = [];
  const nextMessage = (type) =>
    new Promise((resolve) => {
      client.on('message', (data) => {
        const message = JSON.parse(data);
        messages.push(message);
        if (message.type === type) resolve(message);
      });
    });

  await once(client, 'open');
  client.send(JSON.stringify({ type: 'start', language: 'auto' }));
  await nextMessage('ready');

  client.send(Buffer.alloc(3200));
  await nextMessage('interim');

  client.send(JSON.stringify({ type: 'stop' }));
  const { transcription } = await nextMessage('saved');
  client.close();

  assert.equal(transcription.text, 'Kal ki meeting 10 बजे है');
  assert.equal(transcription.language, 'hi-en');
  assert.ok(messages.some((m) => m.type === 'final'));
});
