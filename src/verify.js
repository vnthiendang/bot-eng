const assert = require('assert');
const { spawn } = require('child_process');
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

const {
  deriveWordFamily,
  evaluateSentenceFast,
  generateReadingExercise,
  generateQuizBatchFast,
} = require('./fastEngine');

const {
  DEFAULT_SPREADSHEET_ID,
  parseCsv,
  parseSheetRows,
  getGoogleAuthUrl,
} = require('./sheetsService');

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

  console.log('--- 7. Kiểm thử FastEngine, Reading Cloze & Đa dạng bài tập ---');
  const familyCheck = deriveWordFamily('resilience', 'Noun', 'Tính từ: resilient; Đồng nghĩa: grit, adaptability');
  assert.ok(familyCheck.nouns.some((x) => x.word.toLowerCase() === 'resilience'));
  assert.ok(familyCheck.adjectives.some((x) => x.word.toLowerCase() === 'resilient'));
  assert.ok(familyCheck.synonyms.includes('grit'));

  const fastEval = await evaluateSentenceFast(
    'resilient',
    'she are resilient during hard time',
    createWordEntry({ word: 'resilient', partOfSpeech: 'adjective', note: 'Tính từ' })
  );
  assert.strictEqual(fastEval.isCorrectUsage, true);
  assert.ok(fastEval.score >= 40 && fastEval.score <= 100);
  assert.ok(typeof fastEval.correctedSentence === 'string' && fastEval.correctedSentence.endsWith('.'));
  assert.ok(fastEval.upgradedVersions && fastEval.upgradedVersions.natural);

  const quizSeed = [
    createWordEntry({
      word: 'Accomplish',
      partOfSpeech: 'Verb',
      meaningVi: 'Hoàn thành, đạt được',
      topic: 'Công việc',
      examples: ['We worked hard to accomplish our yearly goals ahead of schedule.'],
    }),
    createWordEntry({
      word: 'Collaborate',
      partOfSpeech: 'Verb',
      meaningVi: 'Hợp tác, cộng tác',
      topic: 'Công việc',
      examples: ['Different departments need to collaborate closely to finish this project.'],
    }),
    createWordEntry({
      word: 'Resilience',
      partOfSpeech: 'Noun',
      meaningVi: 'Sự kiên cường',
      topic: 'Phát triển bản thân',
      examples: ['Showing resilience in difficult times is a key trait of a good leader.'],
      note: 'Tính từ: resilient',
    }),
  ];

  const readingPack = generateReadingExercise(quizSeed, 'Công việc');
  assert.ok(readingPack.blanks.length >= 2);
  assert.ok(readingPack.passageWithBlanks.includes('__(1)__') || readingPack.passageWithBlanks.includes('(1) _____'));

  const readingQuiz = generateQuizBatchFast(quizSeed, 'reading_cloze', 3);
  assert.ok(readingQuiz.questions.length >= 2);
  for (const q of readingQuiz.questions) {
    assert.strictEqual(q.type, 'reading_cloze');
    assert.strictEqual(q.options.length, 4);
    assert.ok(q.options.includes(q.correctAnswer));
  }

  const mixedQuiz = generateQuizBatchFast(quizSeed, 'mixed', 5);
  assert.strictEqual(mixedQuiz.questions.length, 5);
  assert.ok(mixedQuiz.questions.some((q) => q.type === 'reading_cloze'));
  console.log('OK: FastEngine, Reading Cloze và Quiz 5 chế độ hoạt động ổn định.');

  console.log('--- 8. Kiểm thử Google Sheet CSV Parser & OAuth URL ---');
  const csvRows = parseCsv('col1,"quoted, cell","say ""hi"""\na,b,c');
  assert.strictEqual(csvRows.length, 2);
  assert.strictEqual(csvRows[0][1], 'quoted, cell');
  assert.strictEqual(csvRows[0][2], 'say "hi"');

  const sampleSheetCsv = [
    ',,,,,,,,,',
    ',Tổng kết,12,Đã thuộc,5,,,,,',
    ',Từ vựng,Phiên âm (IPA),Từ loại,Nghĩa tiếng Việt,Chủ đề,Ví dụ câu,Trạng thái,Độ khó,Ghi chú',
    ',Accomplish,/əˈkʌm.plɪʃ/,Verb,"Hoàn thành, đạt được",Công việc,We need to accomplish our goals.,Đã thuộc,Trung bình (B2),Thường đi với goal / task',
    ',Benchmark,/ˈbentʃ.mɑːrk/,Noun,Điểm chuẩn,Kinh doanh,This report sets a new benchmark.,Cần ôn tập,Trung bình (B2),',
  ].join('\n');

  const parsedSheet = parseSheetRows(sampleSheetCsv);
  assert.strictEqual(parsedSheet.words.length, 2);
  assert.strictEqual(parsedSheet.words[0].word, 'Accomplish');
  assert.strictEqual(parsedSheet.words[0].srs.masteryScore, 85);
  assert.strictEqual(parsedSheet.words[1].srs.masteryScore, 20);
  assert.strictEqual(parsedSheet.summary.total, 2);
  assert.strictEqual(parsedSheet.summary.mastered, 1);
  assert.strictEqual(parsedSheet.summary.needReview, 1);

  const prevClientId = process.env.GOOGLE_CLIENT_ID;
  const prevClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const prevRedirect = process.env.GOOGLE_REDIRECT_URI;
  process.env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
  process.env.GOOGLE_CLIENT_SECRET = 'test-secret';
  process.env.GOOGLE_REDIRECT_URI = 'https://antigravity.google/oauth-callback';
  try {
    const authUrl = getGoogleAuthUrl('verify-state');
    assert.ok(authUrl.startsWith('https://accounts.google.com/o/oauth2/auth?'));
    assert.ok(authUrl.includes('spreadsheets'));
    assert.ok(authUrl.includes('verify-state'));
  } finally {
    if (prevClientId === undefined) delete process.env.GOOGLE_CLIENT_ID;
    else process.env.GOOGLE_CLIENT_ID = prevClientId;
    if (prevClientSecret === undefined) delete process.env.GOOGLE_CLIENT_SECRET;
    else process.env.GOOGLE_CLIENT_SECRET = prevClientSecret;
    if (prevRedirect === undefined) delete process.env.GOOGLE_REDIRECT_URI;
    else process.env.GOOGLE_REDIRECT_URI = prevRedirect;
  }
  console.log('OK: Google Sheet CSV Parser và Google OAuth URL builder hoạt động chính xác.');

  console.log('--- 9. Kiểm thử MCP Server (stdio JSON-RPC 2.0) & mcp_config.json ---');
  const globalMcpPath = path.join(os.homedir(), '.gemini', 'config', 'mcp_config.json');
  assert.ok(fs.existsSync(globalMcpPath), `Thiếu file cấu hình MCP toàn cục: ${globalMcpPath}`);
  const globalMcpCfg = JSON.parse(fs.readFileSync(globalMcpPath, 'utf8'));
  const mcpEntry = globalMcpCfg?.mcpServers?.['vocab-daily-sheets'];
  assert.ok(mcpEntry, 'mcp_config.json phải có server vocab-daily-sheets');
  assert.strictEqual(mcpEntry.command, 'node');
  assert.ok(Array.isArray(mcpEntry.args) && mcpEntry.args[0].endsWith('mcpServer.js'));
  assert.strictEqual(mcpEntry.env?.SPREADSHEET_ID, DEFAULT_SPREADSHEET_ID);

  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(__dirname, 'mcpServer.js')], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdoutBuf = '';
    const responses = new Map();
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`MCP server timeout. Output so far: ${stdoutBuf}`));
    }, 5000);

    child.stdout.on('data', (chunk) => {
      stdoutBuf += chunk.toString('utf8');
      const lines = stdoutBuf.split(/\r?\n/);
      stdoutBuf = lines.pop() || '';
      for (const line of lines) {
        if (!line.trim()) continue;
        const msg = JSON.parse(line);
        if (msg.id !== undefined) responses.set(msg.id, msg);
        if (responses.has(1) && responses.has(2)) {
          clearTimeout(timer);
          try {
            const initRes = responses.get(1);
            assert.strictEqual(initRes.result?.serverInfo?.name, 'vocab-daily-sheets-mcp');
            const toolsRes = responses.get(2);
            const toolNames = (toolsRes.result?.tools || []).map((t) => t.name);
            assert.deepStrictEqual(toolNames, [
              'sheets_sync_vocab',
              'vocab_lookup_fast',
              'writing_evaluate_fast',
              'reading_generate_passage',
              'google_oauth_url',
            ]);
            child.kill();
            resolve();
          } catch (err) {
            child.kill();
            reject(err);
          }
        }
      }
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} })}\n`);
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`);
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} })}\n`);
  });
  console.log('OK: Stdio MCP Server và mcp_config.json hoạt động đúng chuẩn (5 tools).');

  console.log('\nTẤT CẢ KIỂM THỬ ĐỀU ĐẠT!');
}

runTests().catch((err) => {
  console.error('Kiểm thử thất bại:', err);
  process.exit(1);
});
