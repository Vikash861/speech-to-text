// Tests the real thing: streams a recorded Hinglish sentence to a running server the same way
// the browser does, prints Gemini's live transcription, then deletes the saved row again.
//
// Usage: npm run test:live                                  (server on http://localhost:3000)
//        npm run test:live -- https://your-app.onrender.com
import { readFileSync } from 'node:fs';

const baseUrl = process.argv[2] ?? 'http://localhost:3000';
const CHUNK_BYTES = 3200; // 100 ms of 16 kHz 16-bit mono audio, the same chunk size the browser sends

// The clip says: "नमस्ते, कल की meeting सुबह दस बजे है, तो please सबको inform कर देना.
// और project report Friday तक submit करनी है."
const wav = readFileSync(new URL('../test/fixtures/hinglish.wav', import.meta.url));
const silence = Buffer.alloc(CHUNK_BYTES * 10); // 1 second, like a pause before pressing Stop
const audio = Buffer.concat([wav.subarray(44), silence]); // the first 44 bytes are the WAV header

setTimeout(() => fail('Timed out after 60 seconds'), 60_000).unref();

const socket = new WebSocket(`${baseUrl.replace(/^http/, 'ws')}/ws/transcribe`);

socket.onopen = () => socket.send(JSON.stringify({ type: 'start', language: 'auto' }));
socket.onerror = () => fail(`Could not connect to ${baseUrl}`);

socket.onmessage = async (event) => {
  const message = JSON.parse(event.data);

  if (message.type === 'ready') {
    console.log('Connected to Gemini, streaming audio...');
    await streamAudio();
  } else if (message.type === 'interim') {
    console.log('  interim:', message.text);
  } else if (message.type === 'final') {
    console.log('  final:  ', message.text);
  } else if (message.type === 'saved') {
    socket.close();
    await checkAndCleanUp(message.transcription);
  } else if (message.type === 'error') {
    fail(message.message);
  }
};

async function streamAudio() {
  for (let i = 0; i < audio.length; i += CHUNK_BYTES) {
    socket.send(audio.subarray(i, i + CHUNK_BYTES));
    await new Promise((resolve) => setTimeout(resolve, 100)); // real-time speed
  }
  socket.send(JSON.stringify({ type: 'stop' }));
}

async function checkAndCleanUp(transcription) {
  if (!transcription) fail('Nothing was transcribed');

  console.log(`\nSaved as #${transcription.id} (language: ${transcription.language})`);
  await fetch(`${baseUrl}/api/transcriptions/${transcription.id}`, { method: 'DELETE' });

  if (!/meeting|मीटिंग/i.test(transcription.text)) fail('The transcription does not contain "meeting"');
  console.log('PASS: transcribed, saved and deleted again');
}

function fail(reason) {
  console.error(`FAIL: ${reason}`);
  process.exit(1);
}
