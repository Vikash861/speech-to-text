import WebSocket from 'ws';

const GEMINI_URL =
  'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';
const MODEL = process.env.GEMINI_MODEL ?? 'gemini-3.5-transcribe-live';

export function connectGemini({ languageCodes, onReady, onInterim, onFinal, onClose }) {
  const url = `${process.env.GEMINI_URL ?? GEMINI_URL}?key=${process.env.GEMINI_API_KEY}`;
  const ws = new WebSocket(url);
  const send = (message) => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify(message));

  ws.on('open', () =>
    send({
      setup: {
        model: `models/${MODEL}`,
        generationConfig: { responseModalities: ['TEXT'] },
        inputAudioTranscription: { languageCodes },
      },
    }),
  );

  ws.on('message', (data) => {
    let message;
    try {
      message = JSON.parse(data);
    } catch {
      return;
    }
    if (message.setupComplete) onReady();

    const interim = message.serverContent?.interimInputTranscription?.text;
    const final = message.serverContent?.inputTranscription?.text;
    if (interim) onInterim(interim);
    if (final) onFinal(final);
  });

  ws.on('error', (err) => console.error('Gemini error:', err.message));
  ws.on('close', (code, reason) => onClose(`${code} ${reason}`.trim()));

  return {
    sendAudio: (pcm) => send({ realtimeInput: { audio: { data: pcm.toString('base64'), mimeType: 'audio/pcm;rate=16000' } } }),
    end: () => send({ realtimeInput: { audioStreamEnd: true } }),
    close: () => ws.close(),
  };
}
