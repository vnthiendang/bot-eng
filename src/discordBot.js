require('dotenv').config();
const crypto = require('crypto');
const cron = require('node-cron');
const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  SlashCommandBuilder,
  REST,
  Routes,
  AttachmentBuilder,
} = require('discord.js');

const {
  analyzeWord,
  evaluateSentence,
  generateQuizBatch,
} = require('./geminiService');
const {
  loadStore,
  findWordIndex,
  detectTargetWordInSentence,
  upsertWord,
  recordSentencePractice,
  recordQuizResult,
} = require('./storageService');
const {
  getDueWords,
  getLocalDateKey,
  DEFAULT_TIMEZONE,
} = require('./srsService');

// In-memory interaction sessions
const quizSessions = new Map();
const pendingWritingTargets = new Map(); // userId -> { word, expiresAt }

function truncate(str, max = 1000) {
  const s = String(str || '');
  return s.length > max ? `${s.slice(0, max - 3)}...` : s;
}

function formatFamilyList(items = []) {
  if (!Array.isArray(items) || items.length === 0) return '—';
  return items
    .slice(0, 5)
    .map((item) => `• **${item.word}** — ${item.meaningVi || ''}`)
    .join('\n');
}

function buildWordEmbed(wordEntry, titlePrefix = '') {
  const wf = wordEntry.wordFamily || {};
  const collocationsText = (wordEntry.collocations || [])
    .slice(0, 4)
    .map((c) => `• **${c.phrase}** — ${c.meaningVi}`)
    .join('\n') || '—';

  const examplesText = (wordEntry.examples || [])
    .slice(0, 2)
    .map((ex, i) => `${i + 1}. ${ex}`)
    .join('\n') || '—';

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`${titlePrefix}${wordEntry.word} ${wordEntry.ipa ? `\`${wordEntry.ipa}\`` : ''}`)
    .setDescription(
      `**Loại từ:** ${wordEntry.partOfSpeech || '—'} | **Ngữ cảnh:** ${wordEntry.register || 'General'}\n` +
      `**Nghĩa:** ${wordEntry.meaningVi || '—'}\n` +
      `*${wordEntry.meaningEn || ''}*`
    )
    .addFields(
      { name: '📘 Danh từ (Noun)', value: truncate(formatFamilyList(wf.nouns)), inline: true },
      { name: '⚡ Động từ (Verb)', value: truncate(formatFamilyList(wf.verbs)), inline: true },
      { name: '🎨 Tính / Trạng từ', value: truncate(`**Adj:** ${formatFamilyList(wf.adjectives)}\n**Adv:** ${formatFamilyList(wf.adverbs)}`), inline: true },
      {
        name: '🔗 Đồng nghĩa / Trái nghĩa',
        value: truncate(
          `Đồng nghĩa: ${(wf.synonyms || []).join(', ') || '—'}\nTrái nghĩa: ${(wf.antonyms || []).join(', ') || '—'}`
        ),
        inline: false,
      },
      { name: '🧩 Collocations thường gặp', value: truncate(collocationsText), inline: false },
      { name: '💬 Ví dụ & Gợi ý đặt câu', value: truncate(`${examplesText}\n\n**Thử thách:** ${wordEntry.writingPrompt || `Đặt 1 câu dùng "${wordEntry.word}"`}`), inline: false }
    )
    .setFooter({ text: `Mastery: ${wordEntry.srs?.masteryScore || 0}% | Gõ trực tiếp câu tiếng Anh để được chấm điểm` });

  return embed;
}

function buildWordActionRow(wordEntry) {
  const safeWord = encodeURIComponent(wordEntry.word).slice(0, 60);
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`write_modal:${safeWord}`)
      .setLabel('✍️ Viết câu với từ này')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`word_quiz:word_form:${safeWord}`)
      .setLabel('🧩 Quiz họ từ')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`word_quiz:mixed:${safeWord}`)
      .setLabel('🔄 Tạo bài tập ôn tập')
      .setStyle(ButtonStyle.Secondary)
  );
}

function buildEvaluationEmbed(targetWord, userSentence, evaluation, stats) {
  const score = Number(evaluation.score) || 0;
  const color = score >= 80 ? 0x22c55e : score >= 60 ? 0xf59e0b : 0xef4444;

  const errorsText =
    Array.isArray(evaluation.grammarErrors) && evaluation.grammarErrors.length > 0
      ? evaluation.grammarErrors
          .slice(0, 4)
          .map(
            (e, i) =>
              `**${i + 1}. [${e.rule || 'Grammar'}]**\n❌ \`${e.original}\` -> ✅ \`${e.correction}\`\n*${e.explanationVi}*`
          )
          .join('\n\n')
      : 'Không phát hiện lỗi ngữ pháp nghiêm trọng.';

  const upgrades = evaluation.upgradedVersions || {};
  const upgradesText = [
    upgrades.natural ? `• **Tự nhiên:** ${upgrades.natural}` : '',
    upgrades.academic ? `• **Học thuật / IELTS:** ${upgrades.academic}` : '',
    upgrades.collocationRich ? `• **Giàu Collocation:** ${upgrades.collocationRich}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return new EmbedBuilder()
    .setColor(color)
    .setTitle(`Chấm câu với từ "${targetWord}" — Điểm: ${score}/100`)
    .addFields(
      { name: '📝 Câu của bạn', value: truncate(userSentence), inline: false },
      { name: '✅ Câu đã chuẩn hóa', value: truncate(evaluation.correctedSentence || userSentence), inline: false },
      { name: '🔍 Lỗi cấu trúc & Ngữ pháp', value: truncate(errorsText), inline: false },
      { name: '🧬 Nhận xét dạng từ & Collocation', value: truncate(evaluation.wordFormFeedback || '—'), inline: false },
      { name: '🚀 3 cách nâng cấp câu', value: truncate(upgradesText || '—'), inline: false }
    )
    .setFooter({
      text: `${evaluation.encouragementVi || ''} | Streak: ${stats?.currentStreak || 0} ngày`,
    });
}

function buildStatsEmbed(store) {
  const words = store.words || [];
  const stats = store.stats || {};
  const due = getDueWords(words);
  const mastered = words.filter((w) => (w.srs?.masteryScore || 0) >= 80).length;
  const todayKey = getLocalDateKey();
  const todayLog = stats.dailyLog?.[todayKey] || { wordsAdded: 0, sentencesWritten: 0, quizzesCompleted: 0 };

  return new EmbedBuilder()
    .setColor(0x0ea5e9)
    .setTitle('📊 Thống kê luyện tập VocabDaily')
    .addFields(
      { name: '🔥 Chuỗi Streak', value: `**${stats.currentStreak || 0} ngày** (Kỷ lục: ${stats.longestStreak || 0})`, inline: true },
      { name: '📚 Kho từ vựng', value: `**${words.length} từ** (Thành thạo: ${mastered})`, inline: true },
      { name: '⏰ Cần ôn hôm nay', value: `**${due.length} từ**`, inline: true },
      {
        name: `📅 Hoạt động hôm nay (${todayKey})`,
        value: `• Từ mới: **${todayLog.wordsAdded}**\n• Câu đã viết: **${todayLog.sentencesWritten}**\n• Bài quiz đã làm: **${todayLog.quizzesCompleted}**`,
        inline: false,
      }
    )
    .setFooter({ text: 'Mẹo: Gõ "+ <từ vựng>" để thêm từ nhanh, hoặc gõ thẳng 1 câu tiếng Anh để chấm điểm.' });
}

function createQuizSessionMessage(questions, userId) {
  const sessionId = crypto.randomUUID().slice(0, 8);
  quizSessions.set(sessionId, {
    userId,
    questions,
    index: 0,
    score: 0,
    createdAt: Date.now(),
  });
  return renderQuizQuestion(sessionId);
}

function renderQuizQuestion(sessionId) {
  const session = quizSessions.get(sessionId);
  if (!session) return null;

  const q = session.questions[session.index];
  if (!q) return null;

  const typeLabelMap = {
    word_form: 'Biến đổi Họ từ (Word Form)',
    error_spot: 'Tìm lỗi sai Ngữ pháp / Collocation',
    multiple_choice: 'Trắc nghiệm Ngữ cảnh',
    sentence_transform: 'Viết lại câu (Active Recall)',
  };

  const embed = new EmbedBuilder()
    .setColor(0x8b5cf6)
    .setTitle(`🧩 Câu ${session.index + 1}/${session.questions.length} — ${typeLabelMap[q.type] || q.type}`)
    .setDescription(`**Từ mục tiêu:** \`${q.targetWord}\`\n\n${q.question}`)
    .addFields({ name: '💡 Gợi ý', value: q.hint || 'Đọc kỹ ngữ cảnh và loại từ cần dùng.', inline: false })
    .setFooter({ text: `Điểm hiện tại: ${session.score}/${session.index}` });

  const components = [];
  if (Array.isArray(q.options) && q.options.length > 0) {
    const labels = ['A', 'B', 'C', 'D'];
    const row = new ActionRowBuilder();
    q.options.slice(0, 4).forEach((opt, optIdx) => {
      embed.addFields({ name: `${labels[optIdx]}`, value: truncate(opt, 250), inline: true });
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`quiz_ans:${sessionId}:${session.index}:${optIdx}`)
          .setLabel(labels[optIdx])
          .setStyle(ButtonStyle.Primary)
      );
    });
    components.push(row);
  } else {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`quiz_write:${sessionId}:${session.index}`)
        .setLabel('✍️ Nhập câu trả lời')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`quiz_reveal:${sessionId}:${session.index}`)
        .setLabel('👁️ Xem đáp án mẫu')
        .setStyle(ButtonStyle.Secondary)
    );
    components.push(row);
  }

  return { embeds: [embed], components };
}

async function handleAddWordAction(wordInput, contextSentence = '') {
  const analyzed = await analyzeWord(wordInput, contextSentence);
  const { word, isNew } = upsertWord(analyzed);
  const prefix = isNew ? '✨ Đã thêm từ mới: ' : '🔄 Đã cập nhật từ: ';
  return {
    embeds: [buildWordEmbed(word, prefix)],
    components: [buildWordActionRow(word)],
  };
}

async function handleEvaluateSentenceAction(targetWord, userSentence) {
  const store = loadStore();
  const idx = findWordIndex(store.words, targetWord);
  const wordInfo = idx >= 0 ? store.words[idx] : null;
  const resolvedTarget = wordInfo ? wordInfo.word : targetWord;

  const evaluation = await evaluateSentence(resolvedTarget, userSentence, wordInfo);
  let latestStats = store.stats;
  if (idx >= 0) {
    const recorded = recordSentencePractice(resolvedTarget, evaluation, userSentence);
    if (recorded) latestStats = recorded.stats;
  }
  return {
    embeds: [buildEvaluationEmbed(resolvedTarget, userSentence, evaluation, latestStats)],
  };
}

async function handleStartQuizAction(userId, mode = 'mixed', specificWord = null) {
  const store = loadStore();
  if (!store.words.length) {
    throw new Error('Kho từ vựng đang trống. Hãy gõ `+ <từ vựng>` để thêm từ đầu tiên.');
  }

  let pool = [];
  if (specificWord) {
    const idx = findWordIndex(store.words, specificWord);
    if (idx >= 0) pool = [store.words[idx]];
  }
  if (pool.length === 0) {
    const due = getDueWords(store.words);
    pool = due.length > 0 ? due.slice(0, 6) : store.words.slice(0, 6);
  }

  const count = specificWord ? 3 : 5;
  const quizData = await generateQuizBatch(pool, mode, null, count);
  if (!Array.isArray(quizData.questions) || quizData.questions.length === 0) {
    throw new Error('AI không tạo được câu hỏi lúc này, vui lòng thử lại.');
  }

  return createQuizSessionMessage(quizData.questions, userId);
}

async function sendMorningHabitCard(client, channelId) {
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) return;

  const store = loadStore();
  const due = getDueWords(store.words);
  const topWords = (due.length > 0 ? due : store.words).slice(0, 3);
  if (topWords.length === 0) return;

  const listText = topWords
    .map((w, i) => `**${i + 1}. ${w.word}** ${w.ipa || ''} — ${w.meaningVi}`)
    .join('\n');

  const embed = new EmbedBuilder()
    .setColor(0xf97316)
    .setTitle('☀️ Thử thách 3 phút buổi sáng')
    .setDescription(
      `Chuỗi Streak hiện tại: **${store.stats?.currentStreak || 0} ngày**.\n\n**3 từ cần ôn tập hôm nay:**\n${listText}`
    )
    .setFooter({ text: 'Hoàn thành 1 câu viết hoặc 1 mini quiz để giữ nhịp thói quen hôm nay.' });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('daily_quick_quiz')
      .setLabel('🚀 Bắt đầu ôn ngay')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`write_modal:${encodeURIComponent(topWords[0].word).slice(0, 60)}`)
      .setLabel(`✍️ Đặt 1 câu với "${topWords[0].word}"`)
      .setStyle(ButtonStyle.Success)
  );

  await channel.send({ embeds: [embed], components: [row] });
}

async function sendEveningStreakHook(client, channelId) {
  const store = loadStore();
  const todayKey = getLocalDateKey();
  if (store.stats?.lastPracticeDate === todayKey) {
    return; // User already practiced today
  }

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) return;

  const due = getDueWords(store.words);
  const samplePool = (due.length > 0 ? due : store.words).slice(0, 3);
  if (samplePool.length === 0) return;

  try {
    const quizData = await generateQuizBatch(samplePool, 'word_form', null, 1);
    const question = quizData?.questions?.[0];
    if (question) {
      const sessionId = crypto.randomUUID().slice(0, 8);
      quizSessions.set(sessionId, {
        userId: 'evening-hook',
        questions: [question],
        index: 0,
        score: 0,
        createdAt: Date.now(),
      });
      const rendered = renderQuizQuestion(sessionId);
      const hookEmbed = new EmbedBuilder()
        .setColor(0xef4444)
        .setTitle('🌙 Đừng để đứt chuỗi Streak hôm nay!')
        .setDescription(
          `Hôm nay bạn chưa luyện tập (Streak hiện tại: **${store.stats?.currentStreak || 0} ngày**).\nChỉ cần trả lời 1 câu hỏi nhanh dưới đây để giữ Streak:`
        );
      await channel.send({ embeds: [hookEmbed, ...rendered.embeds], components: rendered.components });
      return;
    }
  } catch (err) {
    console.warn('[Discord Cron] Fallback evening reminder without AI quiz:', err.message);
  }

  await channel.send(
    `🌙 **Nhắc nhẹ cuối ngày:** Bạn chưa luyện từ nào hôm nay (Streak: ${store.stats?.currentStreak || 0} ngày). Gõ \`!write\` hoặc \`!quiz\` để giữ chuỗi nhé!`
  );
}

async function registerSlashCommands(token, clientId, guildId) {
  if (!token || !clientId) return;
  const commands = [
    new SlashCommandBuilder()
      .setName('add')
      .setDescription('Thêm từ vựng mới và phân tích Họ từ (Word Family)')
      .addStringOption((opt) => opt.setName('word').setDescription('Từ hoặc cụm từ tiếng Anh').setRequired(true))
      .addStringOption((opt) => opt.setName('context').setDescription('Câu ngữ cảnh bạn bắt gặp (tùy chọn)').setRequired(false)),
    new SlashCommandBuilder()
      .setName('write')
      .setDescription('Nhận thử thách viết câu với từ vựng cần ôn')
      .addStringOption((opt) => opt.setName('word').setDescription('Từ muốn luyện viết (tùy chọn)').setRequired(false)),
    new SlashCommandBuilder()
      .setName('quiz')
      .setDescription('Làm chuỗi bài tập ôn tập đa dạng')
      .addStringOption((opt) =>
        opt
          .setName('mode')
          .setDescription('Dạng bài tập')
          .setRequired(false)
          .addChoices(
            { name: 'Trộn đa dạng (Mixed)', value: 'mixed' },
            { name: 'Biến đổi họ từ (Word Form)', value: 'word_form' },
            { name: 'Tìm lỗi sai (Error Spot)', value: 'error_spot' },
            { name: 'Trắc nghiệm ngữ cảnh', value: 'multiple_choice' },
            { name: 'Viết lại câu', value: 'sentence_transform' }
          )
      ),
    new SlashCommandBuilder()
      .setName('family')
      .setDescription('Xem sơ đồ họ từ (Noun/Verb/Adj/Adv) của một từ')
      .addStringOption((opt) => opt.setName('word').setDescription('Từ cần tra họ từ').setRequired(true)),
    new SlashCommandBuilder().setName('stats').setDescription('Xem chuỗi Streak và tiến độ học tập'),
    new SlashCommandBuilder().setName('export').setDescription('Xuất file sao lưu vocab-backup.json'),
    new SlashCommandBuilder().setName('help').setDescription('Xem hướng dẫn sử dụng nhanh VocabDaily Bot'),
  ].map((c) => c.toJSON());

  const rest = new REST({ version: '10' }).setToken(token);
  try {
    if (guildId) {
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
    } else {
      await rest.put(Routes.applicationCommands(clientId), { body: commands });
    }
    console.log('[Discord Bot] Đã đăng ký Slash Commands thành công.');
  } catch (err) {
    console.warn('[Discord Bot] Không thể đăng ký Slash Commands:', err.message);
  }
}

async function startDiscordBot() {
  const token = (process.env.DISCORD_BOT_TOKEN || '').trim();
  if (!token || token === 'your_discord_bot_token_here') {
    console.log('[Discord Bot] Chưa cấu hình DISCORD_BOT_TOKEN — bỏ qua chế độ Bot (Web UI vẫn hoạt động bình thường).');
    return null;
  }

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Channel],
  });

  client.once('ready', async () => {
    console.log(`[Discord Bot] Đã đăng nhập dưới tên ${client.user.tag}`);
    await registerSlashCommands(token, process.env.DISCORD_CLIENT_ID || client.user.id, process.env.DISCORD_GUILD_ID);

    const channelId = (process.env.DISCORD_CHANNEL_ID || '').trim();
    if (channelId) {
      const tz = process.env.TIMEZONE || DEFAULT_TIMEZONE;
      const morningCron = process.env.MORNING_CRON || '0 8 * * *';
      const eveningCron = process.env.EVENING_CRON || '0 21 * * *';

      if (cron.validate(morningCron)) {
        cron.schedule(morningCron, () => sendMorningHabitCard(client, channelId), { timezone: tz });
      }
      if (cron.validate(eveningCron)) {
        cron.schedule(eveningCron, () => sendEveningStreakHook(client, channelId), { timezone: tz });
      }
      console.log(`[Discord Bot] Đã bật lịch nhắc thói quen (${morningCron} & ${eveningCron}, TZ: ${tz})`);
    }
  });

  // Handle text shortcuts: "+ word", "!add", "!write", "!quiz", "!family", "!stats", "!export", or direct English sentences
  client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    const content = message.content.trim();
    if (!content) return;

    try {
      // Quick add: "+ resilient" or "+ resilient | The team stayed resilient."
      if (content.startsWith('+') && content.length > 2) {
        const raw = content.slice(1).trim();
        const [wordPart, contextPart] = raw.split('|').map((s) => s.trim());
        await message.channel.sendTyping();
        const replyPayload = await handleAddWordAction(wordPart, contextPart || '');
        await message.reply(replyPayload);
        return;
      }

      if (content === '!help') {
        await message.reply(
          [
            '**Hướng dẫn nhanh VocabDaily Bot:**',
            '• `+ <từ vựng>` — Thêm từ mới, phân tích IPA, nghĩa, Collocations và Họ từ',
            '• Gõ trực tiếp 1 câu tiếng Anh có chứa từ trong kho — Bot tự chấm lỗi ngữ pháp & gợi ý 3 câu nâng cấp',
            '• `!write [từ]` — Nhận thử thách viết câu từ danh sách cần ôn',
            '• `!quiz [mixed|word_form|error_spot|multiple_choice]` — Làm bộ 5 câu ôn tập tương tác',
            '• `!family <từ>` — Tra nhanh sơ đồ Noun / Verb / Adj / Adv',
            '• `!stats` — Xem Streak và tiến độ hôm nay',
            '• `!export` — Tải file sao lưu `vocab-backup.json`',
          ].join('\n')
        );
        return;
      }

      if (content.startsWith('!add ')) {
        const raw = content.slice(5).trim();
        const [wordPart, contextPart] = raw.split('|').map((s) => s.trim());
        await message.channel.sendTyping();
        const replyPayload = await handleAddWordAction(wordPart, contextPart || '');
        await message.reply(replyPayload);
        return;
      }

      if (content.startsWith('!family ')) {
        const query = content.slice(8).trim();
        const store = loadStore();
        const idx = findWordIndex(store.words, query);
        if (idx === -1) {
          await message.reply(`Chưa thấy "${query}" trong kho. Gõ \`+ ${query}\` để phân tích và thêm ngay.`);
          return;
        }
        await message.reply({
          embeds: [buildWordEmbed(store.words[idx], '🧬 Sơ đồ họ từ: ')],
          components: [buildWordActionRow(store.words[idx])],
        });
        return;
      }

      if (content === '!stats') {
        await message.reply({ embeds: [buildStatsEmbed(loadStore())] });
        return;
      }

      if (content === '!export') {
        const store = loadStore();
        const buffer = Buffer.from(JSON.stringify(store, null, 2), 'utf8');
        const attachment = new AttachmentBuilder(buffer, { name: 'vocab-backup.json' });
        await message.reply({ content: '📦 Bản sao lưu kho từ vựng của bạn:', files: [attachment] });
        return;
      }

      if (content === '!write' || content.startsWith('!write ')) {
        const query = content.slice(6).trim();
        const store = loadStore();
        let entry = null;
        if (query) {
          const idx = findWordIndex(store.words, query);
          entry = idx >= 0 ? store.words[idx] : null;
        } else {
          const due = getDueWords(store.words);
          entry = due[0] || store.words[0];
        }
        if (!entry) {
          await message.reply('Kho từ đang trống. Gõ `+ <từ>` để thêm từ đầu tiên nhé.');
          return;
        }
        pendingWritingTargets.set(message.author.id, {
          word: entry.word,
          expiresAt: Date.now() + 10 * 60 * 1000,
        });
        await message.reply(
          `✍️ **Thử thách viết câu với \`${entry.word}\`** (${entry.meaningVi})\n` +
          `Gợi ý: *${entry.writingPrompt || `Đặt 1 câu tự nhiên sử dụng "${entry.word}" hoặc họ từ của nó.`}*\n` +
          `👉 Hãy gõ thẳng câu tiếng Anh của bạn vào khung chat này!`
        );
        return;
      }

      if (content === '!quiz' || content.startsWith('!quiz ')) {
        const mode = content.slice(5).trim() || 'mixed';
        await message.channel.sendTyping();
        const quizPayload = await handleStartQuizAction(message.author.id, mode);
        await message.reply(quizPayload);
        return;
      }

      // Check if user has an active pending writing target or typed a sentence containing a known vocab word
      if (!content.startsWith('!') && !content.startsWith('/')) {
        const pending = pendingWritingTargets.get(message.author.id);
        const store = loadStore();
        let targetEntry = null;

        if (pending && pending.expiresAt > Date.now()) {
          const idx = findWordIndex(store.words, pending.word);
          targetEntry = idx >= 0 ? store.words[idx] : { word: pending.word };
        } else if (content.split(/\s+/).length >= 4 && /^[A-Za-z0-9\s.,'"?!:;()-]+$/.test(content)) {
          targetEntry = detectTargetWordInSentence(store.words, content);
        }

        if (targetEntry) {
          pendingWritingTargets.delete(message.author.id);
          await message.channel.sendTyping();
          const evalPayload = await handleEvaluateSentenceAction(targetEntry.word, content);
          await message.reply(evalPayload);
        }
      }
    } catch (err) {
      await message.reply(`⚠️ Lỗi: ${err.message}`);
    }
  });

  // Handle Slash Commands, Buttons, and Modals
  client.on('interactionCreate', async (interaction) => {
    try {
      if (interaction.isChatInputCommand()) {
        const { commandName } = interaction;
        if (commandName === 'help') {
          await interaction.reply({
            content:
              '**VocabDaily Bot:**\n• `/add <word>` hoặc `+ <word>` — Phân tích & lưu từ mới + họ từ\n• `/write [word]` — Viết câu & chấm lỗi ngữ pháp\n• `/quiz [mode]` — Làm bài tập đa dạng\n• `/family <word>` — Xem họ từ\n• `/stats` — Xem Streak\n• `/export` — Tải file JSON sao lưu',
            ephemeral: true,
          });
          return;
        }
        if (commandName === 'stats') {
          await interaction.reply({ embeds: [buildStatsEmbed(loadStore())] });
          return;
        }
        if (commandName === 'export') {
          const store = loadStore();
          const attachment = new AttachmentBuilder(Buffer.from(JSON.stringify(store, null, 2), 'utf8'), {
            name: 'vocab-backup.json',
          });
          await interaction.reply({ content: '📦 Bản sao lưu kho từ vựng của bạn:', files: [attachment] });
          return;
        }
        if (commandName === 'family') {
          const query = interaction.options.getString('word', true);
          const store = loadStore();
          const idx = findWordIndex(store.words, query);
          if (idx === -1) {
            await interaction.reply(`Chưa thấy "${query}" trong kho. Dùng \`/add ${query}\` để thêm nhé.`);
            return;
          }
          await interaction.reply({
            embeds: [buildWordEmbed(store.words[idx], '🧬 Sơ đồ họ từ: ')],
            components: [buildWordActionRow(store.words[idx])],
          });
          return;
        }
        if (commandName === 'add') {
          const word = interaction.options.getString('word', true);
          const context = interaction.options.getString('context') || '';
          await interaction.deferReply();
          const payload = await handleAddWordAction(word, context);
          await interaction.editReply(payload);
          return;
        }
        if (commandName === 'write') {
          const wordArg = interaction.options.getString('word');
          const store = loadStore();
          let entry = null;
          if (wordArg) {
            const idx = findWordIndex(store.words, wordArg);
            entry = idx >= 0 ? store.words[idx] : { word: wordArg, meaningVi: '', writingPrompt: '' };
          } else {
            const due = getDueWords(store.words);
            entry = due[0] || store.words[0];
          }
          if (!entry) {
            await interaction.reply({ content: 'Kho từ đang trống. Hãy dùng `/add` trước nhé.', ephemeral: true });
            return;
          }
          const modal = new ModalBuilder()
            .setCustomId(`submit_write:${encodeURIComponent(entry.word).slice(0, 60)}`)
            .setTitle(`Viết câu với "${entry.word}"`.slice(0, 45));
          const input = new TextInputBuilder()
            .setCustomId('sentence_input')
            .setLabel(`Đặt câu tiếng Anh (${entry.meaningVi || entry.word})`.slice(0, 45))
            .setPlaceholder(entry.writingPrompt || `Ví dụ dùng từ ${entry.word}...`.slice(0, 90))
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);
          modal.addComponents(new ActionRowBuilder().addComponents(input));
          await interaction.showModal(modal);
          return;
        }
        if (commandName === 'quiz') {
          const mode = interaction.options.getString('mode') || 'mixed';
          await interaction.deferReply();
          const quizPayload = await handleStartQuizAction(interaction.user.id, mode);
          await interaction.editReply(quizPayload);
          return;
        }
      }

      if (interaction.isButton()) {
        const id = interaction.customId;

        if (id === 'daily_quick_quiz') {
          await interaction.deferReply();
          const quizPayload = await handleStartQuizAction(interaction.user.id, 'mixed');
          await interaction.editReply(quizPayload);
          return;
        }

        if (id.startsWith('write_modal:')) {
          const targetWord = decodeURIComponent(id.slice('write_modal:'.length));
          const modal = new ModalBuilder()
            .setCustomId(`submit_write:${encodeURIComponent(targetWord).slice(0, 60)}`)
            .setTitle(`Viết câu với "${targetWord}"`.slice(0, 45));
          const input = new TextInputBuilder()
            .setCustomId('sentence_input')
            .setLabel('Nhập câu tiếng Anh của bạn')
            .setPlaceholder(`Hãy thử áp dụng "${targetWord}" hoặc họ từ của nó...`)
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);
          modal.addComponents(new ActionRowBuilder().addComponents(input));
          await interaction.showModal(modal);
          return;
        }

        if (id.startsWith('word_quiz:')) {
          const [, mode, encodedWord] = id.split(':');
          const targetWord = decodeURIComponent(encodedWord);
          await interaction.deferReply();
          const quizPayload = await handleStartQuizAction(interaction.user.id, mode, targetWord);
          await interaction.editReply(quizPayload);
          return;
        }

        if (id.startsWith('quiz_ans:')) {
          const [, sessionId, qIdxStr, optIdxStr] = id.split(':');
          const session = quizSessions.get(sessionId);
          if (!session) {
            await interaction.reply({ content: 'Phiên quiz đã hết hạn. Gõ `!quiz` để tạo bộ mới.', ephemeral: true });
            return;
          }
          const qIdx = Number(qIdxStr);
          const optIdx = Number(optIdxStr);
          if (qIdx !== session.index) {
            await interaction.reply({ content: 'Câu hỏi này đã được trả lời.', ephemeral: true });
            return;
          }

          const q = session.questions[qIdx];
          const chosen = q.options?.[optIdx];
          const isCorrect =
            String(chosen || '').trim().toLowerCase() === String(q.correctAnswer || '').trim().toLowerCase();

          if (isCorrect) session.score += 1;
          recordQuizResult(q.targetWord, isCorrect);

          const feedback =
            `${isCorrect ? '✅ **Chính xác!**' : `❌ **Chưa đúng.** Đáp án đúng là: **${q.correctAnswer}**`}\n` +
            `💡 *Giải thích:* ${q.explanationVi || '—'}`;

          session.index += 1;
          if (session.index < session.questions.length) {
            const nextRendered = renderQuizQuestion(sessionId);
            await interaction.update({
              content: feedback,
              embeds: nextRendered.embeds,
              components: nextRendered.components,
            });
          } else {
            const total = session.questions.length;
            const finalScore = session.score;
            quizSessions.delete(sessionId);
            await interaction.update({
              content: `${feedback}\n\n🏁 **Hoàn thành bài ôn tập!** Kết quả: **${finalScore}/${total}**. Streak của bạn đã được cập nhật!`,
              embeds: [],
              components: [],
            });
          }
          return;
        }

        if (id.startsWith('quiz_write:')) {
          const [, sessionId, qIdxStr] = id.split(':');
          const modal = new ModalBuilder()
            .setCustomId(`submit_quiz_write:${sessionId}:${qIdxStr}`)
            .setTitle('Trả lời câu hỏi viết lại câu');
          const input = new TextInputBuilder()
            .setCustomId('quiz_sentence_input')
            .setLabel('Câu tiếng Anh của bạn')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);
          modal.addComponents(new ActionRowBuilder().addComponents(input));
          await interaction.showModal(modal);
          return;
        }

        if (id.startsWith('quiz_reveal:')) {
          const [, sessionId, qIdxStr] = id.split(':');
          const session = quizSessions.get(sessionId);
          const q = session?.questions?.[Number(qIdxStr)];
          if (!q) {
            await interaction.reply({ content: 'Phiên quiz đã hết hạn.', ephemeral: true });
            return;
          }
          session.index += 1;
          const revealText = `👁️ **Đáp án mẫu:** ${q.correctAnswer}\n💡 *Giải thích:* ${q.explanationVi || '—'}`;
          if (session.index < session.questions.length) {
            const nextRendered = renderQuizQuestion(sessionId);
            await interaction.update({
              content: revealText,
              embeds: nextRendered.embeds,
              components: nextRendered.components,
            });
          } else {
            quizSessions.delete(sessionId);
            await interaction.update({ content: `${revealText}\n\n🏁 **Hoàn thành phiên ôn tập!**`, embeds: [], components: [] });
          }
          return;
        }
      }

      if (interaction.isModalSubmit()) {
        if (interaction.customId.startsWith('submit_write:')) {
          const targetWord = decodeURIComponent(interaction.customId.slice('submit_write:'.length));
          const userSentence = interaction.fields.getTextInputValue('sentence_input');
          await interaction.deferReply();
          const evalPayload = await handleEvaluateSentenceAction(targetWord, userSentence);
          await interaction.editReply(evalPayload);
          return;
        }

        if (interaction.customId.startsWith('submit_quiz_write:')) {
          const [, sessionId, qIdxStr] = interaction.customId.split(':');
          const session = quizSessions.get(sessionId);
          const q = session?.questions?.[Number(qIdxStr)];
          const userSentence = interaction.fields.getTextInputValue('quiz_sentence_input');
          if (!q) {
            await interaction.reply({ content: 'Phiên quiz đã hết hạn.', ephemeral: true });
            return;
          }
          await interaction.deferReply();
          const evalPayload = await handleEvaluateSentenceAction(q.targetWord, userSentence);
          session.score += 1;
          session.index += 1;
          recordQuizResult(q.targetWord, true);

          if (session.index < session.questions.length) {
            const nextRendered = renderQuizQuestion(sessionId);
            await interaction.editReply({
              content: `✅ Đã chấm câu trả lời! Đáp án mẫu tham khảo: **${q.correctAnswer}**`,
              embeds: [...evalPayload.embeds, ...nextRendered.embeds],
              components: nextRendered.components,
            });
          } else {
            quizSessions.delete(sessionId);
            await interaction.editReply({
              content: `🏁 Hoàn thành bộ bài tập! Đáp án mẫu: **${q.correctAnswer}**`,
              embeds: evalPayload.embeds,
            });
          }
        }
      }
    } catch (err) {
      const msg = `⚠️ Lỗi: ${err.message}`;
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: msg }).catch(() => {});
      } else {
        await interaction.reply({ content: msg, ephemeral: true }).catch(() => {});
      }
    }
  });

  await client.login(token);
  return client;
}

if (require.main === module) {
  startDiscordBot().catch((err) => {
    console.error('[Discord Bot] Lỗi khởi động:', err.message);
    process.exit(1);
  });
}

module.exports = {
  startDiscordBot,
  buildWordEmbed,
  buildEvaluationEmbed,
  buildStatsEmbed,
};
