const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  createWordEntry,
  scoreToQuality,
  updateSRS,
  getDueWords,
  updateDailyStreak,
} = require('./srsService');

const {
  getDefaultStorePath,
  isReadOnlyRuntime,
  loadStore,
  upsertWord,
  deleteWord,
  recordSentencePractice,
  recordQuizResult,
  detectTargetWordInSentence,
  importStore,
} = require('./storageService');

const {
  DEFAULT_DISCORD_GUILD_ID,
  DEFAULT_DISCORD_CHANNEL_ID,
  isAllowedMessageChannel,
  buildWordEmbed,
  buildEvaluationEmbed,
  buildStatsEmbed,
} = require('./discordBot');

const {
  DEFAULT_GEMINI_MODELS,
  extractSuggestedModels,
} = require('./geminiService');

const serverApp = require('./server');
const { createApp } = serverApp;
const geminiApiHandler = require('../api/gemini');

async function runTests() {
  console.log('--- 1. Kiểm thử SRS & Streak Engine ---');
  const entry = createWordEntry({
    word: 'eloquent',
    ipa: '/ˈel.ə.kwənt/',
    partOfSpeech: 'adjective',
    meaningVi: 'Hùng biện, diễn đạt lưu loát',
    wordFamily: {
      nouns: [{ word: 'eloquence', meaningVi: 'sự hùng biện', example: 'She spoke with great eloquence.' }],
      adverbs: [{ word: 'eloquently', meaningVi: 'một cách lưu loát', example: 'He argued eloquently.' }],
      synonyms: ['articulate', 'fluent'],
      antonyms: ['inarticulate'],
    },
  });

  assert.strictEqual(entry.word, 'eloquent');
  assert.strictEqual(entry.wordFamily.nouns[0].word, 'eloquence');
  assert.strictEqual(scoreToQuality(92), 5);
  assert.strictEqual(scoreToQuality(50), 2);

  const day1 = new Date('2026-11-10T08:00:00Z');
  updateSRS(entry, 5, day1);
  assert.strictEqual(entry.srs.repetition, 1);
  assert.strictEqual(entry.srs.interval, 1);
  assert.ok(entry.srs.masteryScore > 0);

  const day2 = new Date('2026-11-11T08:00:00Z');
  updateSRS(entry, 4, day2);
  assert.strictEqual(entry.srs.repetition, 2);
  assert.strictEqual(entry.srs.interval, 6);

  // Streak across consecutive days
  let stats = updateDailyStreak({}, 'word', new Date('2026-11-10T09:00:00+07:00'), 'Asia/Ho_Chi_Minh');
  assert.strictEqual(stats.currentStreak, 1);
  stats = updateDailyStreak(stats, 'sentence', new Date('2026-11-11T09:00:00+07:00'), 'Asia/Ho_Chi_Minh');
  assert.strictEqual(stats.currentStreak, 2);
  assert.strictEqual(stats.longestStreak, 2);
  assert.strictEqual(stats.totalSentencesWritten, 1);

  // Streak reset after skipping a day
  stats = updateDailyStreak(stats, 'quiz', new Date('2026-11-13T09:00:00+07:00'), 'Asia/Ho_Chi_Minh');
  assert.strictEqual(stats.currentStreak, 1);
  assert.strictEqual(stats.longestStreak, 2);
  console.log('OK: SRS SM-2 và Daily Streak hoạt động chính xác.');

  console.log('--- 2. Kiểm thử StorageService (JSON) ---');
  const tmpStorePath = path.join(os.tmpdir(), `vocab-daily-test-${Date.now()}.json`);
  try {
    const initial = loadStore(tmpStorePath);
    assert.ok(Array.isArray(initial.words) && initial.words.length >= 3, 'Phải seed từ mẫu khi chưa có file');

    const added = upsertWord(
      {
        word: 'pragmatic',
        meaningVi: 'thực tế, thực dụng',
        wordFamily: {
          nouns: [{ word: 'pragmatism', meaningVi: 'chủ nghĩa thực dụng', example: '' }],
        },
      },
      tmpStorePath
    );
    assert.strictEqual(added.isNew, true);

    const storeAfterAdd = loadStore(tmpStorePath);
    const detected = detectTargetWordInSentence(storeAfterAdd.words, 'We need pragmatism in this project.');
    assert.ok(detected && detected.word === 'pragmatic', 'Phải nhận diện được từ qua wordFamily');

    const practiced = recordSentencePractice(
      'pragmatic',
      { score: 88, correctedSentence: 'We need a pragmatic plan.', isCorrectUsage: true },
      'We need pragmatic plan.',
      tmpStorePath
    );
    assert.ok(practiced.word.history.length === 1);

    const quizzed = recordQuizResult('pragmatic', true, tmpStorePath);
    assert.strictEqual(quizzed.stats.totalQuizzesCompleted, 1);

    const due = getDueWords(loadStore(tmpStorePath).words);
    assert.ok(due.length >= 3);

    const imported = importStore({ words: [{ word: 'concise', meaningVi: 'ngắn gọn' }] }, 'merge', tmpStorePath);
    assert.ok(imported.words.some((w) => w.word === 'concise'));

    const deleted = deleteWord('concise', tmpStorePath);
    assert.strictEqual(deleted.removed, true);
    console.log('OK: StorageService đọc/ghi/import/export an toàn.');
  } finally {
    if (fs.existsSync(tmpStorePath)) fs.unlinkSync(tmpStorePath);
  }

  console.log('--- 3. Kiểm thử Discord Embed Builders ---');
  const wEmbed = buildWordEmbed(entry);
  assert.ok(wEmbed.data.title.includes('eloquent'));
  const eEmbed = buildEvaluationEmbed(
    'eloquent',
    'She give an eloquent speech.',
    {
      score: 82,
      correctedSentence: 'She gave an eloquent speech.',
      grammarErrors: [{ original: 'give', correction: 'gave', rule: 'Past Tense', explanationVi: 'Dùng thì quá khứ.' }],
      wordFormFeedback: 'Dùng đúng tính từ eloquent.',
      upgradedVersions: { natural: 'She delivered an eloquent speech.' },
      encouragementVi: 'Tốt!',
    },
    stats
  );
  assert.ok(eEmbed.data.title.includes('82/100'));
  const sEmbed = buildStatsEmbed({ words: [entry], stats });
  assert.ok(sEmbed.data.title.includes('Thống kê'));
  assert.strictEqual(DEFAULT_DISCORD_GUILD_ID, '1527710940345274528');
  assert.strictEqual(DEFAULT_DISCORD_CHANNEL_ID, '1571201031440961728');
  assert.strictEqual(isAllowedMessageChannel({ guild: { id: '1527710940345274528' }, channelId: '1571201031440961728' }), true);
  assert.strictEqual(isAllowedMessageChannel({ guild: { id: '1527710940345274528' }, channelId: '9999999999999999999' }), false);
  assert.strictEqual(isAllowedMessageChannel({ guild: null, channelId: 'dm-1' }), true);
  console.log('OK: Discord.js v14, Embed Builders và bộ lọc channel hoạt động chính xác.');

  console.log('--- 4. Kiểm thử Express Server & Web UI Endpoints ---');
  const app = createApp();
  await new Promise((resolve, reject) => {
    const server = app.listen(0, async () => {
      try {
        const { port } = server.address();
        const base = `http://127.0.0.1:${port}`;

        const healthRes = await fetch(`${base}/api/health`);
        assert.strictEqual(healthRes.status, 200);
        const healthJson = await healthRes.json();
        assert.strictEqual(healthJson.ok, true);

        const vocabRes = await fetch(`${base}/api/vocab`);
        assert.strictEqual(vocabRes.status, 200);
        const vocabJson = await vocabRes.json();
        assert.ok(Array.isArray(vocabJson.words) && vocabJson.words.length >= 3);

        for (const asset of ['/', '/styles.css', '/app.js']) {
          const res = await fetch(`${base}${asset}`);
          assert.strictEqual(res.status, 200, `${asset} phải trả về 200 OK`);
          const text = await res.text();
          assert.ok(text.length > 100, `${asset} không được rỗng`);
        }

        const badActionRes = await fetch(`${base}/api/gemini`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'unknown' }),
        });
        assert.strictEqual(badActionRes.status, 400);

        console.log(`OK: Express server & tài nguyên Web UI phản hồi 200 OK (test port ${port}).`);
        server.close(resolve);
      } catch (err) {
        server.close(() => reject(err));
      }
    });
  });

  console.log('--- 5. Kiểm thử Gemini Model Config & Fallback Parser ---');
  assert.strictEqual(DEFAULT_GEMINI_MODELS[0], 'gemini-3.8-flash');
  const suggested = extractSuggestedModels(
    'This model models/gemini-2.0-flash is no longer available. Please update your code to use models/gemini-3.8-flash for the latest features.',
    'gemini-2.0-flash'
  );
  assert.deepStrictEqual(suggested, ['gemini-3.8-flash']);
  console.log('OK: Cấu hình model mặc định và trích xuất model thay thế hoạt động chính xác.');

  console.log('--- 6. Kiểm thử Vercel Serverless Compatibility ---');
  assert.strictEqual(typeof serverApp, 'function', 'server.js phải export trực tiếp Express app handler');
  assert.strictEqual(typeof createApp, 'function');
  assert.strictEqual(typeof geminiApiHandler, 'function');

  const prevVercel = process.env.VERCEL;
  process.env.VERCEL = '1';
  const vercelStorePath = getDefaultStorePath();
  try {
    assert.strictEqual(isReadOnlyRuntime(), true);
    assert.ok(vercelStorePath.startsWith(os.tmpdir()), 'Trên Vercel phải ghi file tạm vào os.tmpdir()');
    const vercelStore = loadStore(vercelStorePath);
    assert.ok(Array.isArray(vercelStore.words) && vercelStore.words.length >= 3);
  } finally {
    if (prevVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = prevVercel;
    if (fs.existsSync(vercelStorePath)) fs.unlinkSync(vercelStorePath);
  }
  console.log('OK: Export Express app và Storage Vercel Serverless hoạt động an toàn.');

  console.log('\nTẤT CẢ KIỂM THỬ ĐỀU ĐẠT!');
}

runTests().catch((err) => {
  console.error('Kiểm thử thất bại:', err);
  process.exit(1);
});
