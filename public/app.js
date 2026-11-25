const $ = (id) => document.getElementById(id);
const languageNames = { hi: 'Hindi', en: 'English', 'hi-en': 'Hindi + English', unknown: 'Unknown' };

let socket, stream, audioContext, timerId;
let editingItem = null;
let searchTimer;

async function api(url, method = 'GET', body) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) throw new Error(data.error);
  return data;
}

function formatTime(ms) {
  const sec = Math.round(ms / 1000);
  const mm = String(Math.floor(sec / 60)).padStart(2, '0');
  const ss = String(sec % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

function setStatus(text, isError = false) {
  $('status').textContent = text;
  $('status').classList.toggle('error', isError);
}

function setButton(label, disabled = false, recording = false) {
  $('record').textContent = label;
  $('record').disabled = disabled;
  $('record').classList.toggle('recording', recording);
}

async function startRecording() {
  setButton('Connecting...', true);
  $('final').textContent = '';
  $('interim').textContent = '';
  $('timer').textContent = '00:00';

  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  } catch {
    setButton('Start');
    setStatus('Microphone permission denied', true);
    return;
  }

  const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
  socket = new WebSocket(`${protocol}://${location.host}/ws/transcribe`);
  socket.onopen = () => socket.send(JSON.stringify({ type: 'start', language: $('language').value }));
  socket.onmessage = (e) => handleMessage(JSON.parse(e.data));
  socket.onclose = cleanup;
}

async function startAudio() {
  audioContext = new AudioContext();
  await audioContext.audioWorklet.addModule('pcm-worklet.js');

  const worklet = new AudioWorkletNode(audioContext, 'pcm-capture', { numberOfOutputs: 0 });
  worklet.port.onmessage = (e) => {
    if (socket && socket.readyState === WebSocket.OPEN) socket.send(e.data);
  };
  audioContext.createMediaStreamSource(stream).connect(worklet);

  const startTime = Date.now();
  timerId = setInterval(() => {
    $('timer').textContent = formatTime(Date.now() - startTime);
  }, 500);
}

function stopRecording() {
  stopAudio();
  setButton('Saving...', true);
  socket.send(JSON.stringify({ type: 'stop' }));
}

function stopAudio() {
  clearInterval(timerId);
  if (stream) stream.getTracks().forEach((track) => track.stop());
  if (audioContext) audioContext.close();
  stream = null;
  audioContext = null;
}

function cleanup() {
  stopAudio();
  socket = null;
  setButton('Start');
}

async function handleMessage(msg) {
  if (msg.type === 'ready') {
    await startAudio();
    setButton('Stop', false, true);
    setStatus('Listening... speak in Hindi, English or both');
  } else if (msg.type === 'interim') {
    $('interim').textContent = msg.text;
  } else if (msg.type === 'final') {
    $('final').textContent += ' ' + msg.text;
    $('interim').textContent = '';
  } else if (msg.type === 'saved') {
    setStatus(msg.transcription ? 'Saved' : 'No speech detected');
    socket.close();
    loadHistory();
  } else if (msg.type === 'error') {
    setStatus(msg.message, true);
    if (!audioContext) socket.close();
  }
}

async function loadHistory() {
  const items = await api('/api/transcriptions?q=' + encodeURIComponent($('search').value));
  const list = $('list');
  list.innerHTML = '';

  if (items.length === 0) {
    list.innerHTML = '<li class="empty">No transcriptions yet</li>';
    return;
  }
  items.forEach((item) => list.appendChild(renderItem(item)));
}

function renderItem(item) {
  const li = document.createElement('li');
  li.className = 'item';
  li.innerHTML = `
    <h3></h3>
    <p></p>
    <div class="meta"></div>
    <div class="row">
      <button class="btn listen">Listen</button>
      <button class="btn edit">Edit</button>
      <button class="btn danger delete">Delete</button>
    </div>`;

  const source = item.durationMs ? `Recorded ${formatTime(item.durationMs)}` : 'Added manually';
  li.querySelector('h3').textContent = item.title;
  li.querySelector('p').textContent = item.text;
  li.querySelector('.meta').textContent =
    `${languageNames[item.language]} | ${source} | ${new Date(item.createdAt).toLocaleString()}`;

  li.querySelector('.listen').onclick = () => speak(item);
  li.querySelector('.edit').onclick = () => openEditor(item);
  li.querySelector('.delete').onclick = () => deleteItem(item);
  return li;
}

async function deleteItem(item) {
  if (!confirm(`Delete "${item.title}"?`)) return;
  await api(`/api/transcriptions/${item.id}`, 'DELETE');
  loadHistory();
}

function speak(item) {
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(item.text);
  utterance.lang = item.language === 'en' ? 'en-IN' : 'hi-IN';
  speechSynthesis.speak(utterance);
}

function openEditor(item = null) {
  const form = $('editor-form');
  editingItem = item;
  $('editor-heading').textContent = item ? 'Edit transcription' : 'New transcription';
  form.title.value = item ? item.title : '';
  form.text.value = item ? item.text : '';
  $('editor-error').textContent = '';
  $('editor').showModal();
}

async function saveEditor(e) {
  e.preventDefault();
  const form = $('editor-form');
  const body = { text: form.text.value };
  if (form.title.value.trim()) body.title = form.title.value;

  try {
    if (editingItem) {
      await api(`/api/transcriptions/${editingItem.id}`, 'PATCH', body);
    } else {
      await api('/api/transcriptions', 'POST', body);
    }
    $('editor').close();
    loadHistory();
  } catch (err) {
    $('editor-error').textContent = err.message;
  }
}

async function checkHealth() {
  const health = await api('/api/health');
  let text = 'Ready';
  if (!health.db) text = 'Database offline';
  else if (!health.gemini) text = 'Gemini key missing';

  $('health').textContent = text;
  $('health').className = text === 'Ready' ? 'health ok' : 'health bad';
}

$('record').onclick = () => (audioContext ? stopRecording() : startRecording());
$('new').onclick = () => openEditor();
$('cancel').onclick = () => $('editor').close();
$('editor-form').onsubmit = saveEditor;
$('search').oninput = () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadHistory, 300);
};

checkHealth();
loadHistory();
