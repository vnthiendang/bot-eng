const {
  analyzeWord,
  evaluateSentence,
  generateQuizBatch,
} = require('../src/geminiService');

async function sendDiscordWebhookPayload(webhookUrl, { words = [], stats = {}, customMessage = '' }) {
  const url = (webhookUrl || process.env.DISCORD_WEBHOOK_URL || '').trim();
  if (!url) {
    throw new Error('Thiếu Discord Webhook URL.');
  }

  const dueList = words.slice(0, 3);
  const fields = dueList.map((w, idx) => ({
    name: `${idx + 1}. ${w.word} ${w.ipa || ''} (${w.partOfSpeech || ''})`,
    value: `**Nghĩa:** ${w.meaningVi}\n**Gợi ý viết câu:** ${w.writingPrompt || `Đặt 1 câu với "${w.word}"`}`,
    inline: false,
  }));

  const payload = {
    username: 'VocabDaily Coach',
    embeds: [
      {
        title: customMessage ? 'Nhắc nhở luyện tập hằng ngày' : 'Thử thách từ vựng hôm nay (3 phút)',
        description:
          customMessage ||
          `Chuỗi Streak hiện tại: **${stats.currentStreak || 0} ngày** | Tổng câu đã viết: **${stats.totalSentencesWritten || 0}**.\nHãy chọn 1 từ dưới đây và viết 1 câu ngay bây giờ!`,
        color: 5793266,
        fields,
        footer: {
          text: 'VocabDaily • Active Recall & Word Family Trainer',
        },
        timestamp: new Date().toISOString(),
      },
    ],
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Discord Webhook lỗi (${res.status}): ${errText || res.statusText}`);
  }
  return { sent: true };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, service: 'vocab-daily-gemini-api' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const { action, apiKey } = body;

    if (action === 'analyze') {
      const result = await analyzeWord(body.word, body.contextSentence, apiKey);
      return res.status(200).json({ ok: true, data: result });
    }

    if (action === 'evaluate') {
      const result = await evaluateSentence(body.targetWord, body.userSentence, body.wordInfo, apiKey);
      return res.status(200).json({ ok: true, data: result });
    }

    if (action === 'quiz') {
      const result = await generateQuizBatch(body.wordsList, body.quizType, apiKey, body.count || 5);
      return res.status(200).json({ ok: true, data: result });
    }

    if (action === 'discordWebhook') {
      const result = await sendDiscordWebhookPayload(body.webhookUrl, {
        words: body.words,
        stats: body.stats,
        customMessage: body.customMessage,
      });
      return res.status(200).json({ ok: true, data: result });
    }

    return res.status(400).json({ error: `Action không hợp lệ: ${action}` });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message || 'Lỗi xử lý yêu cầu.' });
  }
};
