const {
  analyzeWordFast,
  evaluateSentenceFast,
  generateReadingExercise,
  generateQuizBatchFast,
} = require('./fastEngine');

const DEFAULT_GEMINI_MODELS = ['gemini-3.8-flash', 'gemini-2.5-flash'];

function extractJsonText(rawText) {
  if (!rawText) throw new Error('Gemini returned empty response');
  let cleaned = rawText.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  }
  return JSON.parse(cleaned);
}

function extractSuggestedModels(message, excludeModel = '') {
  if (!message) return [];
  const matches = [...String(message).matchAll(/models\/([a-zA-Z0-9._-]+)/g)].map((m) => m[1]);
  const excluded = String(excludeModel || '').toLowerCase();
  return [...new Set(matches)].filter((name) => name.toLowerCase() !== excluded);
}

async function discoverAvailableModels(key) {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`);
    if (!res.ok) return [];
    const data = await res.json().catch(() => ({}));
    const list = Array.isArray(data.models) ? data.models : [];

    return list
      .filter((m) => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
      .map((m) => String(m.name || '').replace(/^models\//, ''))
      .filter((name) => /^gemini-/i.test(name) && !/(embedding|imagen|veo|tts|audio|robotics|computer-use)/i.test(name));
  } catch {
    return [];
  }
}

async function callGeminiJSON(prompt, apiKey, temperature = 0.4) {
  const key = (apiKey || process.env.GEMINI_API_KEY || '').trim();
  if (!key) {
    throw new Error('Thiếu GEMINI_API_KEY.');
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_GEMINI_MODELS[0]}:generateContent?key=${encodeURIComponent(key)}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature, responseMimeType: 'application/json' },
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error?.message || `HTTP ${response.status}`);
  }
  return extractJsonText(payload?.candidates?.[0]?.content?.parts?.[0]?.text);
}

/**
 * Analyze a word rapidly via Free Dictionary + Datamuse + Google Translate GTX (<200-400ms).
 */
async function analyzeWord(word, contextSentence = '', _apiKey, customMeta = {}) {
  return analyzeWordFast(word, contextSentence, customMeta);
}

/**
 * Evaluate sentence grammar, word usage, and word family rapidly via LanguageTool.
 */
async function evaluateSentence(targetWord, userSentence, wordInfo = null) {
  return evaluateSentenceFast(targetWord, userSentence, wordInfo);
}

/**
 * Generate multi-mode exercises (word_form, error_spot, multiple_choice, sentence_transform, reading_cloze).
 */
async function generateQuizBatch(wordsList = [], quizType = 'mixed', _apiKey, count = 5) {
  return generateQuizBatchFast(wordsList, quizType, count);
}

module.exports = {
  DEFAULT_GEMINI_MODELS,
  extractSuggestedModels,
  discoverAvailableModels,
  callGeminiJSON,
  analyzeWord,
  evaluateSentence,
  generateQuizBatch,
  generateReadingExercise,
};
