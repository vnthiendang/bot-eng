require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');

const geminiHandler = require('../api/gemini');
const {
  isReadOnlyRuntime,
  loadStore,
  upsertWord,
  deleteWord,
  recordSentencePractice,
  recordQuizResult,
  importStore,
} = require('./storageService');
const { getDueWords } = require('./srsService');
const {
  DEFAULT_SPREADSHEET_ID,
  syncWithGoogleSheet,
  getGoogleAuthUrl,
  exchangeCodeForTokens,
} = require('./sheetsService');

function resolvePublicDir() {
  const relativePublic = path.join(__dirname, '..', 'public');
  if (fs.existsSync(relativePublic)) return relativePublic;
  return path.join(process.cwd(), 'public');
}

function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '2mb' }));

  const publicDir = resolvePublicDir();
  app.use(express.static(publicDir));

  app.get('/api/health', (req, res) => {
    const token = (process.env.DISCORD_BOT_TOKEN || '').trim();
    const botConfigured = Boolean(token && token !== 'your_discord_bot_token_here');
    res.json({
      ok: true,
      mode: isReadOnlyRuntime() ? 'vercel-express' : 'local-express',
      hasGeminiEnvKey: Boolean((process.env.GEMINI_API_KEY || '').trim()),
      hasWebhookEnv: Boolean((process.env.DISCORD_WEBHOOK_URL || '').trim()),
      botConfigured,
    });
  });

  app.get('/api/vocab', (req, res) => {
    const store = loadStore();
    const dueIds = new Set(getDueWords(store.words).map((w) => w.id));
    res.json({
      ok: true,
      ...store,
      dueCount: dueIds.size,
    });
  });

  app.post('/api/vocab/upsert', (req, res) => {
    try {
      const result = upsertWord(req.body);
      res.json({ ok: true, word: result.word, isNew: result.isNew, store: result.store });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/vocab/record-sentence', (req, res) => {
    const { wordIdOrName, evaluation, userSentence } = req.body || {};
    const result = recordSentencePractice(wordIdOrName, evaluation || {}, userSentence || '');
    if (!result) {
      return res.status(404).json({ ok: false, error: 'Không tìm thấy từ trong kho local.' });
    }
    res.json({ ok: true, ...result });
  });

  app.post('/api/vocab/record-quiz', (req, res) => {
    const { targetWord, isCorrect } = req.body || {};
    const result = recordQuizResult(targetWord, Boolean(isCorrect));
    res.json({ ok: true, ...result });
  });

  app.post('/api/vocab/import', (req, res) => {
    try {
      const { data, mode } = req.body || {};
      const store = importStore(data || req.body, mode || 'merge');
      res.json({ ok: true, store });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  });

  app.delete('/api/vocab/:idOrWord', (req, res) => {
    const result = deleteWord(decodeURIComponent(req.params.idOrWord));
    res.json({ ok: true, ...result });
  });

  app.post('/api/sheets/sync', async (req, res) => {
    try {
      const sheetId = (req.body?.spreadsheetId || DEFAULT_SPREADSHEET_ID).trim();
      const result = await syncWithGoogleSheet(undefined, sheetId);
      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/google/auth-url', (req, res) => {
    try {
      res.json({ ok: true, url: getGoogleAuthUrl() });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/google/exchange', async (req, res) => {
    try {
      const code = req.body?.code || '';
      await exchangeCodeForTokens(code);
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  });

  // Reuse Vercel serverless handler for /api/gemini
  app.all('/api/gemini', (req, res) => geminiHandler(req, res));

  app.get('*', (req, res) => {
    const indexPath = path.join(publicDir, 'index.html');
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }
    return res.status(404).send('Not Found');
  });

  return app;
}

const app = createApp();
app.createApp = createApp;

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  const server = app.listen(port, () => {
    console.log(`[VocabDaily] Web UI đang chạy tại http://localhost:${port}`);
    const { startDiscordBot } = require('./discordBot');
    startDiscordBot().catch((err) => {
      console.error('[Discord Bot] Không thể kết nối:', err.message);
    });
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[VocabDaily] Cổng ${port} đang bận. Hãy thử PORT=3001 npm start`);
    } else {
      console.error('[VocabDaily] Server error:', err);
    }
    process.exit(1);
  });
}

module.exports = app;
