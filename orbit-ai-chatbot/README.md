# Orbit AI Chatbot

A responsive, dark-mode AI chat demo with original Orbit branding, chat history, a typing indicator, suggestion prompts, copy/regenerate controls, and a server-side OpenAI integration.

## Requirements

- Node.js 20 or newer
- An OpenAI API key with API access and billing configured

## Run locally

1. Extract the project ZIP and open a terminal in the `orbit-ai-chatbot` folder.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Copy `.env.example` to `.env`.
   - macOS/Linux: `cp .env.example .env`
   - Windows PowerShell: `Copy-Item .env.example .env`

4. Open `.env` and replace `your_api_key_here` with your API key. You may change `OPENAI_MODEL` to a model available to your account.
5. Start the server:

   ```bash
   npm start
   ```

6. Visit **http://localhost:3000**.

The API key stays on the server and is never sent to the browser. If you do not configure a key, the UI will still load, but chat requests show a clear configuration error rather than pretending to be real AI.

## Features

- Responsive desktop/mobile layout with sidebar
- New conversation, history selection, deletion, and clear-current-chat
- Local browser history using `localStorage`
- Real replies via the OpenAI API, called from the Express backend
- Typing indicator, Enter-to-send, Shift+Enter for a newline
- Suggestion cards, copy reply, regenerate last response
- Input validation, JSON size limit, basic per-IP rate limiting, secure headers, and user-friendly API errors

## Project structure

```text
orbit-ai-chatbot/
├── public/
│   ├── app.js
│   ├── index.html
│   └── styles.css
├── .env.example
├── .gitignore
├── package.json
├── README.md
└── server.js
```

## Security notes before deployment

- Never commit `.env`; it is excluded by `.gitignore`.
- Never put the API key in `public/app.js`, HTML, or any `NEXT_PUBLIC_*` / client-exposed variable.
- The included in-memory rate limiter is intended for a single-process demo. For public production use, add authentication, a shared rate-limit store, request logging/monitoring, abuse controls, and a deployment platform's secret manager.
- Browser chat history is stored locally on that device and is not encrypted or synced. Avoid entering sensitive personal information.
- Set an appropriate budget/usage limit in your API provider account. API usage may incur charges.
- Serve over HTTPS when deployed. Do not expose the local development server directly to the public internet.

## Troubleshooting

- **“AI service isn't configured yet”**: make sure `.env` exists in the project root and has `OPENAI_API_KEY=...`; restart `npm start`.
- **“API key was rejected”**: check that the key is valid and has access to the selected model.
- **Rate limit or quota error**: review API usage, billing, and provider limits.
- **Port already in use**: run with a different port, e.g. `PORT=3001 npm start`, then visit `http://localhost:3001`.
