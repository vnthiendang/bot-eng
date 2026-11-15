const crypto = require('crypto');

const DEFAULT_TIMEZONE = process.env.TIMEZONE || 'Asia/Ho_Chi_Minh';

/**
 * Return YYYY-MM-DD string in the target timezone.
 */
function getLocalDateKey(date = new Date(), timeZone = DEFAULT_TIMEZONE) {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

/**
 * Difference in calendar days between two YYYY-MM-DD strings (dateB - dateA).
 */
function diffCalendarDays(dateKeyA, dateKeyB) {
  if (!dateKeyA || !dateKeyB) return null;
  const [y1, m1, d1] = dateKeyA.split('-').map(Number);
  const [y2, m2, d2] = dateKeyB.split('-').map(Number);
  const utcA = Date.UTC(y1, m1 - 1, d1);
  const utcB = Date.UTC(y2, m2 - 1, d2);
  return Math.round((utcB - utcA) / (24 * 60 * 60 * 1000));
}

function normalizeFamilyArray(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((item) => {
      if (typeof item === 'string') {
        return { word: item.trim(), meaningVi: '', example: '' };
      }
      return {
        word: String(item?.word || '').trim(),
        meaningVi: String(item?.meaningVi || '').trim(),
        example: String(item?.example || '').trim(),
      };
    })
    .filter((item) => item.word);
}

function normalizeStringArray(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map((item) => String(item || '').trim()).filter(Boolean);
}

function normalizeCollocations(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((item) => {
      if (typeof item === 'string') {
        return { phrase: item.trim(), meaningVi: '', example: '' };
      }
      return {
        phrase: String(item?.phrase || '').trim(),
        meaningVi: String(item?.meaningVi || '').trim(),
        example: String(item?.example || '').trim(),
      };
    })
    .filter((item) => item.phrase);
}

/**
 * Create a standardized vocabulary entry with Word Family, Collocations, and SM-2 SRS metadata.
 */
function createWordEntry(wordData) {
  const now = new Date().toISOString();
  const family = wordData.wordFamily || {};
  const baseWord = String(wordData.word || '').trim();

  return {
    id: wordData.id || `w-${crypto.randomUUID().slice(0, 8)}`,
    word: baseWord,
    ipa: String(wordData.ipa || '').trim(),
    partOfSpeech: String(wordData.partOfSpeech || '').trim(),
    register: String(wordData.register || wordData.topic || 'General').trim(),
    topic: String(wordData.topic || wordData.register || 'Chung').trim(),
    status: String(wordData.status || 'Đang học').trim(),
    difficulty: String(wordData.difficulty || 'Trung bình (B2)').trim(),
    note: String(wordData.note || '').trim(),
    source: String(wordData.source || 'local').trim(),
    meaningVi: String(wordData.meaningVi || '').trim(),
    meaningEn: String(wordData.meaningEn || '').trim(),
    wordFamily: {
      nouns: normalizeFamilyArray(family.nouns),
      verbs: normalizeFamilyArray(family.verbs),
      adjectives: normalizeFamilyArray(family.adjectives),
      adverbs: normalizeFamilyArray(family.adverbs),
      synonyms: normalizeStringArray(family.synonyms),
      antonyms: normalizeStringArray(family.antonyms),
    },
    collocations: normalizeCollocations(wordData.collocations),
    examples: normalizeStringArray(wordData.examples),
    writingPrompt: String(wordData.writingPrompt || '').trim(),
    srs: {
      interval: 0,
      repetition: 0,
      efactor: 2.5,
      nextReviewDate: now,
      masteryScore: 0,
      ...(wordData.srs || {}),
    },
    history: Array.isArray(wordData.history) ? wordData.history : [],
    createdAt: wordData.createdAt || now,
  };
}

/**
 * Convert a 0-100 writing score to SM-2 quality (0-5).
 */
function scoreToQuality(score) {
  const num = Number(score) || 0;
  if (num >= 90) return 5;
  if (num >= 78) return 4;
  if (num >= 65) return 3;
  if (num >= 45) return 2;
  if (num >= 25) return 1;
  return 0;
}

/**
 * Update SM-2 Spaced Repetition state on a word entry.
 * quality: integer 0..5 (0-2 = fail/reset, 3-5 = pass).
 */
function updateSRS(wordEntry, quality, referenceDate = new Date()) {
  const q = Math.max(0, Math.min(5, Math.round(Number(quality) || 0)));
  const current = wordEntry.srs || {
    interval: 0,
    repetition: 0,
    efactor: 2.5,
    nextReviewDate: referenceDate.toISOString(),
    masteryScore: 0,
  };

  let repetition = Number(current.repetition) || 0;
  let interval = Number(current.interval) || 0;
  let efactor = Number(current.efactor) || 2.5;
  let masteryScore = Number(current.masteryScore) || 0;

  if (q < 3) {
    repetition = 0;
    interval = 1;
    masteryScore = Math.max(5, masteryScore - 15);
  } else {
    if (repetition === 0) {
      interval = 1;
    } else if (repetition === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * efactor);
    }
    repetition += 1;
    const gain = q === 5 ? 25 : q === 4 ? 18 : 10;
    masteryScore = Math.min(100, masteryScore + gain);
  }

  efactor = efactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  if (efactor < 1.3) efactor = 1.3;
  efactor = Number(efactor.toFixed(2));

  const nextDate = new Date(referenceDate.getTime() + interval * 24 * 60 * 60 * 1000);

  wordEntry.srs = {
    interval,
    repetition,
    efactor,
    nextReviewDate: nextDate.toISOString(),
    masteryScore,
    lastReviewedAt: referenceDate.toISOString(),
  };

  return wordEntry.srs;
}

/**
 * Return words due for review at referenceDate, prioritized by oldest due date and lowest mastery.
 */
function getDueWords(words = [], referenceDate = new Date()) {
  const nowMs = referenceDate.getTime();
  return [...words]
    .filter((w) => {
      if (!w?.srs?.nextReviewDate) return true;
      const dueMs = new Date(w.srs.nextReviewDate).getTime();
      return Number.isNaN(dueMs) || dueMs <= nowMs;
    })
    .sort((a, b) => {
      const aDue = new Date(a?.srs?.nextReviewDate || 0).getTime();
      const bDue = new Date(b?.srs?.nextReviewDate || 0).getTime();
      if (aDue !== bDue) return aDue - bDue;
      return (a?.srs?.masteryScore || 0) - (b?.srs?.masteryScore || 0);
    });
}

/**
 * Update daily practice streak and activity log.
 * activityType: 'word' | 'sentence' | 'quiz'
 */
function updateDailyStreak(stats = {}, activityType = 'sentence', referenceDate = new Date(), timeZone = DEFAULT_TIMEZONE) {
  const todayKey = getLocalDateKey(referenceDate, timeZone);
  const nextStats = {
    currentStreak: Number(stats.currentStreak) || 0,
    longestStreak: Number(stats.longestStreak) || 0,
    lastPracticeDate: stats.lastPracticeDate || null,
    totalSentencesWritten: Number(stats.totalSentencesWritten) || 0,
    totalQuizzesCompleted: Number(stats.totalQuizzesCompleted) || 0,
    dailyLog: { ...(stats.dailyLog || {}) },
  };

  if (nextStats.lastPracticeDate !== todayKey) {
    const gap = diffCalendarDays(nextStats.lastPracticeDate, todayKey);
    if (gap === 1) {
      nextStats.currentStreak += 1;
    } else {
      nextStats.currentStreak = 1;
    }
    nextStats.lastPracticeDate = todayKey;
    if (nextStats.currentStreak > nextStats.longestStreak) {
      nextStats.longestStreak = nextStats.currentStreak;
    }
  }

  const todayEntry = {
    wordsAdded: 0,
    sentencesWritten: 0,
    quizzesCompleted: 0,
    ...(nextStats.dailyLog[todayKey] || {}),
  };

  if (activityType === 'word') {
    todayEntry.wordsAdded += 1;
  } else if (activityType === 'sentence') {
    todayEntry.sentencesWritten += 1;
    nextStats.totalSentencesWritten += 1;
  } else if (activityType === 'quiz') {
    todayEntry.quizzesCompleted += 1;
    nextStats.totalQuizzesCompleted += 1;
  }

  nextStats.dailyLog[todayKey] = todayEntry;
  return nextStats;
}

module.exports = {
  DEFAULT_TIMEZONE,
  getLocalDateKey,
  diffCalendarDays,
  createWordEntry,
  scoreToQuality,
  updateSRS,
  getDueWords,
  updateDailyStreak,
};
