# Speech to Text

Real-time speech to text that works with mixed Hindi and English (Hinglish). Transcriptions are saved in PostgreSQL and shown in a history dashboard where you can create, view, edit, search and delete them.

**Stack:** Node.js, Express, WebSocket (`ws`), PostgreSQL with Prisma ORM, Gemini Live API, plain HTML/CSS/JS.

## How it works

```
Browser mic -> AudioWorklet (16kHz PCM) -> WebSocket -> Node server -> Gemini Live API
                                                            |
Browser  <-------------- interim / final text --------------+
                                                            |
                                            saved to PostgreSQL on Stop
```

1. The browser records the mic and converts it to 16kHz 16-bit PCM in an AudioWorklet (`public/pcm-worklet.js`).
2. Audio chunks (100ms each) are sent over a WebSocket to the server (`src/transcribe.js`).
3. The server forwards them to the Gemini Live API (`src/gemini.js`). The API key never reaches the browser.
4. Gemini sends back interim text (shown in grey while you speak) and final text.
5. When you press Stop, the full text is saved to the database with its detected language (Hindi / English / Hindi + English).

The "Listen" button reads a transcription aloud using the browser's built-in text to speech.

## Project structure

```
src/
  index.js       starts the server and connects to PostgreSQL
  app.js         Express app + WebSocket server
  routes.js      REST API (CRUD)
  db.js          database queries (Prisma)
  gemini.js      Gemini Live API connection
  transcribe.js  one live recording session (browser <-> Gemini)
  text.js        language detection and title helper
prisma/
  schema.prisma  the Transcription model
  migrations/    SQL migrations
public/          frontend (index.html, app.js, styles.css, pcm-worklet.js)
test/            API and live transcription tests
```

The Prisma client is generated into `generated/` by `npm install`, so it is not committed.

## API

| Method | URL | Description |
|---|---|---|
| GET | `/api/transcriptions?q=` | List (with optional search) |
| GET | `/api/transcriptions/:id` | Get one |
| POST | `/api/transcriptions` | Create `{ text, title? }` |
| PATCH | `/api/transcriptions/:id` | Update `{ text?, title? }` |
| DELETE | `/api/transcriptions/:id` | Delete |
| WS | `/ws/transcribe` | Live transcription |

## Run locally

Requirements: Node.js 22.18+, PostgreSQL, and a Gemini API key from https://aistudio.google.com/apikey

```bash
npm install               # also generates the Prisma client
cp .env.example .env      # then fill in DATABASE_URL and GEMINI_API_KEY
npm run db:migrate        # creates the database and tables
npm start                 # http://localhost:3000
```

## Tests

```bash
npm test
```

Tests run against a real PostgreSQL database set in `TEST_DATABASE_URL` (it is created and migrated automatically, and emptied on every run). Gemini is replaced by a fake server, so no API key is needed.

### Live test with the real Gemini API

```bash
npm start                                            # in one terminal (needs GEMINI_API_KEY)
npm run test:live                                    # in another terminal
npm run test:live -- https://your-app.onrender.com   # or against the deployed app
```

It streams a recorded Hinglish sentence (`test/fixtures/hinglish.wav`) at real-time speed, the same way the browser does, prints the live transcription, and deletes the saved row afterwards.

## Deploy (Render)

1. Push this repo to GitHub.
2. On Render: **New > Blueprint** and select the repo. `render.yaml` creates the web service and a PostgreSQL database.
3. Set `GEMINI_API_KEY` when asked.

Migrations run automatically (`prisma migrate deploy`) every time the service starts.

## Limitations

- A Gemini Live session lasts at most 10 minutes, so recording stops automatically at 9.5 minutes.
- Language detection is based on script (Devanagari vs Latin), so Hindi words written in English letters count as English.
