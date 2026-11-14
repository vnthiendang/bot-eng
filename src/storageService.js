const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  createWordEntry,
  updateSRS,
  scoreToQuality,
  updateDailyStreak,
} = require('./srsService');

const DATA_DIR = path.join(__dirname, '..', 'data');
const LOCAL_STORE_PATH = path.join(DATA_DIR, 'vocab.json');
const SAMPLE_STORE_PATH = path.join(DATA_DIR, 'vocab.sample.json');

let bundledSample = null;
try {
  bundledSample = require('../data/vocab.sample.json');
} catch {
  bundledSample = null;
}

let memoryFallbackStore = null;

function isReadOnlyRuntime() {
  return Boolean(
    process.env.VERCEL ||
    process.env.VERCEL_ENV ||
    process.env.AWS_LAMBDA_FUNCTION_NAME
  );
}

function getDefaultStorePath() {
  if (isReadOnlyRuntime()) {
    return path.join(os.tmpdir(), 'vocab-daily-vocab.json');
  }
  return LOCAL_STORE_PATH;
}

function defaultEmptyStore() {
  return {
    words: [],
    stats: {
      currentStreak: 0,
      longestStreak: 0,
      lastPracticeDate: null,
      totalSentencesWritten: 0,
      totalQuizzesCompleted: 0,
      dailyLog: {},
    },
  };
}

function getInitialSeedStore() {
  if (bundledSample && Array.isArray(bundledSample.words)) {
    return JSON.parse(JSON.stringify(bundledSample));
  }
  if (fs.existsSync(SAMPLE_STORE_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(SAMPLE_STORE_PATH, 'utf8'));
    } catch {
      return defaultEmptyStore();
    }
  }
  return defaultEmptyStore();
}

function ensureStoreFile(storePath = getDefaultStorePath()) {
  try {
    const dir = path.dirname(storePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(storePath)) {
      const seed = getInitialSeedStore();
      fs.writeFileSync(storePath, JSON.stringify(seed, null, 2), 'utf8');
    }
    return true;
  } catch (err) {
    console.warn('[storageService] Không thể ghi file store, chuyển sang bộ nhớ tạm:', err.message);
    return false;
  }
}

function loadStore(storePath = getDefaultStorePath()) {
  const fileReady = ensureStoreFile(storePath);
  if (!fileReady) {
    if (!memoryFallbackStore) {
      memoryFallbackStore = getInitialSeedStore();
    }
    return memoryFallbackStore;
  }

  try {
    const raw = fs.readFileSync(storePath, 'utf8');
    const parsed = JSON.parse(raw);
    const base = defaultEmptyStore();
    return {
      words: Array.isArray(parsed.words) ? parsed.words : [],
      stats: { ...base.stats, ...(parsed.stats || {}) },
    };
  } catch (err) {
    console.error('[storageService] Failed to parse store, returning fallback:', err.message);
    return getInitialSeedStore();
  }
}

function saveStore(store, storePath = getDefaultStorePath()) {
  memoryFallbackStore = store;
  try {
    const dir = path.dirname(storePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const tempPath = `${storePath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(store, null, 2), 'utf8');
    fs.renameSync(tempPath, storePath);
  } catch (err) {
    console.warn('[storageService] Ghi file thất bại, giữ bản lưu trong bộ nhớ:', err.message);
  }
  return store;
}

function findWordIndex(words, query) {
  if (!query) return -1;
  const q = String(query).trim().toLowerCase();
  let idx = words.findIndex((w) => w.id?.toLowerCase() === q || w.word?.toLowerCase() === q);
  if (idx !== -1) return idx;

  // Fallback: check wordFamily variants
  idx = words.findIndex((w) => {
    const wf = w.wordFamily || {};
    const forms = [
      ...(wf.nouns || []),
      ...(wf.verbs || []),
      ...(wf.adjectives || []),
      ...(wf.adverbs || []),
    ];
    return forms.some((item) => String(item?.word || '').trim().toLowerCase() === q);
  });
  return idx;
}

/**
 * Find the best matching vocabulary entry whose word or word-family form appears in a sentence.
 */
function detectTargetWordInSentence(words, sentence) {
  if (!sentence || !Array.isArray(words) || words.length === 0) return null;
  const lower = sentence.toLowerCase();

  for (const entry of words) {
    const candidates = [
      entry.word,
      ...(entry.wordFamily?.nouns || []).map((x) => x.word),
      ...(entry.wordFamily?.verbs || []).map((x) => x.word),
      ...(entry.wordFamily?.adjectives || []).map((x) => x.word),
      ...(entry.wordFamily?.adverbs || []).map((x) => x.word),
    ].filter(Boolean);

    for (const candidate of candidates) {
      const escaped = candidate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}(?:s|es|ed|ing|ly)?\\b`, 'i');
      if (regex.test(lower)) {
        return entry;
      }
    }
  }
  return null;
}

function upsertWord(wordData, storePath = getDefaultStorePath()) {
  const store = loadStore(storePath);
  const entry = createWordEntry(wordData);
  const idx = findWordIndex(store.words, entry.word);

  if (idx >= 0) {
    const existing = store.words[idx];
    store.words[idx] = {
      ...entry,
      id: existing.id,
      srs: existing.srs || entry.srs,
      history: existing.history || [],
      createdAt: existing.createdAt || entry.createdAt,
    };
    saveStore(store, storePath);
    return { word: store.words[idx], isNew: false, store };
  }

  store.words.unshift(entry);
  store.stats = updateDailyStreak(store.stats, 'word');
  saveStore(store, storePath);
  return { word: entry, isNew: true, store };
}

function deleteWord(idOrWord, storePath = getDefaultStorePath()) {
  const store = loadStore(storePath);
  const idx = findWordIndex(store.words, idOrWord);
  if (idx === -1) return { removed: false, store };
  store.words.splice(idx, 1);
  saveStore(store, storePath);
  return { removed: true, store };
}

function recordSentencePractice(idOrWord, evaluation, userSentence, storePath = getDefaultStorePath()) {
  const store = loadStore(storePath);
  const idx = findWordIndex(store.words, idOrWord);
  if (idx === -1) return null;

  const entry = store.words[idx];
  const quality = scoreToQuality(evaluation.score);
  updateSRS(entry, quality);

  entry.history = Array.isArray(entry.history) ? entry.history : [];
  entry.history.unshift({
    date: new Date().toISOString(),
    userSentence,
    score: evaluation.score,
    correctedSentence: evaluation.correctedSentence,
    isCorrectUsage: evaluation.isCorrectUsage,
  });
  entry.history = entry.history.slice(0, 20);

  store.stats = updateDailyStreak(store.stats, 'sentence');
  saveStore(store, storePath);
  return { word: entry, stats: store.stats };
}

function recordQuizResult(idOrWord, isCorrect, storePath = getDefaultStorePath()) {
  const store = loadStore(storePath);
  const idx = findWordIndex(store.words, idOrWord);
  if (idx !== -1) {
    updateSRS(store.words[idx], isCorrect ? 4 : 1);
  }
  store.stats = updateDailyStreak(store.stats, 'quiz');
  saveStore(store, storePath);
  return { word: idx !== -1 ? store.words[idx] : null, stats: store.stats };
}

function importStore(imported, mode = 'merge', storePath = getDefaultStorePath()) {
  const incomingWords = Array.isArray(imported?.words) ? imported.words : [];
  const current = mode === 'replace' ? defaultEmptyStore() : loadStore(storePath);

  const byWord = new Map();
  for (const w of current.words) {
    byWord.set(String(w.word || '').toLowerCase(), createWordEntry(w));
  }
  for (const w of incomingWords) {
    if (!w?.word) continue;
    const normalized = createWordEntry(w);
    byWord.set(normalized.word.toLowerCase(), normalized);
  }

  const nextStore = {
    words: Array.from(byWord.values()),
    stats: mode === 'replace'
      ? { ...defaultEmptyStore().stats, ...(imported?.stats || {}) }
      : {
          ...current.stats,
          currentStreak: Math.max(current.stats.currentStreak || 0, imported?.stats?.currentStreak || 0),
          longestStreak: Math.max(current.stats.longestStreak || 0, imported?.stats?.longestStreak || 0),
          totalSentencesWritten: Math.max(
            current.stats.totalSentencesWritten || 0,
            imported?.stats?.totalSentencesWritten || 0
          ),
          totalQuizzesCompleted: Math.max(
            current.stats.totalQuizzesCompleted || 0,
            imported?.stats?.totalQuizzesCompleted || 0
          ),
          dailyLog: { ...(imported?.stats?.dailyLog || {}), ...(current.stats.dailyLog || {}) },
        },
  };

  return saveStore(nextStore, storePath);
}

module.exports = {
  DEFAULT_STORE_PATH: LOCAL_STORE_PATH,
  SAMPLE_STORE_PATH,
  getDefaultStorePath,
  isReadOnlyRuntime,
  loadStore,
  saveStore,
  findWordIndex,
  detectTargetWordInSentence,
  upsertWord,
  deleteWord,
  recordSentencePractice,
  recordQuizResult,
  importStore,
};
