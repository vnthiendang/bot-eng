const DEFAULT_TIMEOUT_MS = 3500;

async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJsonSafe(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  try {
    const res = await fetchWithTimeout(url, options, timeoutMs);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function normalizePos(rawPos = '') {
  const lower = String(rawPos || '').toLowerCase();
  if (lower.includes('noun')) return 'noun';
  if (lower.includes('verb')) return 'verb';
  if (lower.includes('adj')) return 'adjective';
  if (lower.includes('adv')) return 'adverb';
  return lower || 'word';
}

function dedupeFamilyItems(items = []) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const w = String(item?.word || '').trim();
    if (!w) continue;
    const key = w.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      word: w,
      meaningVi: String(item.meaningVi || '').trim(),
      example: String(item.example || '').trim(),
    });
  }
  return out;
}

/**
 * Derive common English Word Family transformations and combine with Sheet notes.
 */
function deriveWordFamily(word, pos = '', noteText = '') {
  const clean = String(word || '').trim();
  const lower = clean.toLowerCase();
  const normPos = normalizePos(pos);

  const family = {
    nouns: [],
    verbs: [],
    adjectives: [],
    adverbs: [],
    synonyms: [],
    antonyms: [],
  };

  if (normPos === 'noun') family.nouns.push({ word: clean, meaningVi: 'danh từ gốc', example: '' });
  if (normPos === 'verb') family.verbs.push({ word: clean, meaningVi: 'động từ gốc', example: '' });
  if (normPos === 'adjective') family.adjectives.push({ word: clean, meaningVi: 'tính từ gốc', example: '' });
  if (normPos === 'adverb') family.adverbs.push({ word: clean, meaningVi: 'trạng từ gốc', example: '' });

  // Parse explicit hints from Google Sheet notes
  if (noteText) {
    const segments = String(noteText).split(/[;|.\n]/);
    for (const seg of segments) {
      const s = seg.trim();
      if (!s) continue;
      let m;
      if ((m = s.match(/danh\s*từ\s*:\s*([a-zA-Z\s-]+)/i))) {
        family.nouns.push({ word: m[1].trim(), meaningVi: 'biến thể danh từ (từ ghi chú)', example: '' });
      } else if ((m = s.match(/động\s*từ\s*:\s*([a-zA-Z\s-]+?)(?:\s+against|\s+with|\s+on|$)/i))) {
        family.verbs.push({ word: m[1].trim(), meaningVi: 'biến thể động từ (từ ghi chú)', example: '' });
      } else if ((m = s.match(/tính\s*từ\s*:\s*([a-zA-Z\s-]+)/i))) {
        family.adjectives.push({ word: m[1].trim(), meaningVi: 'biến thể tính từ (từ ghi chú)', example: '' });
      } else if ((m = s.match(/trạng\s*từ\s*:\s*([a-zA-Z\s-]+)/i))) {
        family.adverbs.push({ word: m[1].trim(), meaningVi: 'biến thể trạng từ (từ ghi chú)', example: '' });
      } else if ((m = s.match(/đồng\s*nghĩa\s*:\s*(.+)/i))) {
        family.synonyms.push(...m[1].split(',').map((x) => x.trim()).filter(Boolean));
      } else if ((m = s.match(/trái\s*nghĩa\s*:\s*(.+)/i))) {
        family.antonyms.push(...m[1].split(',').map((x) => x.trim()).filter(Boolean));
      }
    }
  }

  // Morphological rules for single words when explicit forms are missing
  if (!lower.includes(' ') && lower.length >= 4) {
    if (lower.endsWith('ate')) {
      const stem = clean.slice(0, -1);
      if (family.nouns.length === 0) family.nouns.push({ word: `${stem}ion`, meaningVi: `sự ${clean}`, example: '' });
      if (family.adjectives.length === 0) family.adjectives.push({ word: `${stem}ive`, meaningVi: `mang tính ${clean}`, example: '' });
    } else if (lower.endsWith('ize') || lower.endsWith('ise')) {
      const stem = clean.slice(0, -1);
      if (family.nouns.length === 0) family.nouns.push({ word: `${stem}ation`, meaningVi: `quá trình ${clean}`, example: '' });
    } else if (lower.endsWith('ence') || lower.endsWith('ance')) {
      const adj = `${clean.slice(0, -2)}t`;
      if (family.adjectives.length === 0) family.adjectives.push({ word: adj, meaningVi: 'tính từ liên quan', example: '' });
      if (family.adverbs.length === 0) family.adverbs.push({ word: `${adj}ly`, meaningVi: 'trạng từ liên quan', example: '' });
    } else if (lower.endsWith('ive') && normPos === 'adjective') {
      if (family.adverbs.length === 0) family.adverbs.push({ word: `${clean}ly`, meaningVi: 'một cách...', example: '' });
      if (family.nouns.length === 0) family.nouns.push({ word: `${clean}ness`, meaningVi: 'tính chất...', example: '' });
    } else if (lower.endsWith('able') || lower.endsWith('ible')) {
      if (family.adverbs.length === 0) family.adverbs.push({ word: `${clean.slice(0, -1)}y`, meaningVi: 'một cách...', example: '' });
      if (family.nouns.length === 0) family.nouns.push({ word: `${clean.slice(0, -2)}ility`, meaningVi: 'khả năng...', example: '' });
    } else if (lower.endsWith('ly') && normPos === 'adverb') {
      const baseAdj = clean.slice(0, -2);
      if (family.adjectives.length === 0) family.adjectives.push({ word: baseAdj, meaningVi: 'tính từ gốc', example: '' });
    } else if (normPos === 'verb' && !lower.endsWith('ing')) {
      if (family.nouns.length === 0) family.nouns.push({ word: `${clean}ment`, meaningVi: `sự ${clean}`, example: '' });
    }
  }

  return {
    nouns: dedupeFamilyItems(family.nouns),
    verbs: dedupeFamilyItems(family.verbs),
    adjectives: dedupeFamilyItems(family.adjectives),
    adverbs: dedupeFamilyItems(family.adverbs),
    synonyms: [...new Set(family.synonyms)].slice(0, 6),
    antonyms: [...new Set(family.antonyms)].slice(0, 6),
  };
}

function extractCollocationsFromNotes(word, noteText = '', example = '') {
  const results = [];
  const lowerNote = String(noteText || '');
  let m;
  if ((m = lowerNote.match(/(?:thường\s*)?đi\s*với\s+([^.;\n]+)/i))) {
    const rawTargets = m[1].split(/[,/]/).map((x) => x.trim()).filter(Boolean);
    for (const t of rawTargets) {
      results.push({
        phrase: `${word} ${t}`.trim(),
        meaningVi: 'Cụm từ gợi ý từ ghi chú Sheet',
        example: example || '',
      });
    }
  }
  if ((m = lowerNote.match(/động\s*từ\s*:\s*([a-zA-Z\s]+)/i))) {
    results.push({
      phrase: m[1].trim(),
      meaningVi: 'Cách kết hợp động từ trong ghi chú',
      example: '',
    });
  }
  return results;
}

async function translateViFast(text) {
  if (!text) return '';
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&q=${encodeURIComponent(text)}`;
  const data = await fetchJsonSafe(url, {}, 3000);
  if (Array.isArray(data?.[0])) {
    return data[0].map((part) => part?.[0] || '').join('').trim();
  }
  return '';
}

/**
 * Fast parallel vocabulary lookup using Free Dictionary + Datamuse + Google GTX (<200-400ms).
 */
async function analyzeWordFast(word, contextSentence = '', customMeta = {}) {
  const cleanWord = String(word || '').trim();
  if (!cleanWord) throw new Error('Từ vựng không được để trống.');

  const encoded = encodeURIComponent(cleanWord);
  const [dictData, synData, collData, translatedVi] = await Promise.all([
    fetchJsonSafe(`https://api.dictionaryapi.dev/api/v2/entries/en/${encoded}`),
    fetchJsonSafe(`https://api.datamuse.com/words?rel_syn=${encoded}&max=6`),
    fetchJsonSafe(`https://api.datamuse.com/words?lc=${encoded}&md=p&max=6`),
    customMeta.meaningVi ? Promise.resolve(customMeta.meaningVi) : translateViFast(cleanWord),
  ]);

  const entry = Array.isArray(dictData) ? dictData[0] : null;
  const phonetics = Array.isArray(entry?.phonetics) ? entry.phonetics : [];
  const ipaFound = entry?.phonetic || phonetics.find((p) => p?.text)?.text || '';

  const meanings = Array.isArray(entry?.meanings) ? entry.meanings : [];
  const primaryMeaning = meanings[0] || {};
  const primaryDef = primaryMeaning.definitions?.[0] || {};

  const dictSynonyms = [];
  const dictAntonyms = [];
  const dictExamples = [];

  for (const m of meanings) {
    if (Array.isArray(m.synonyms)) dictSynonyms.push(...m.synonyms);
    if (Array.isArray(m.antonyms)) dictAntonyms.push(...m.antonyms);
    for (const d of m.definitions || []) {
      if (d.example) dictExamples.push(d.example);
      if (Array.isArray(d.synonyms)) dictSynonyms.push(...d.synonyms);
      if (Array.isArray(d.antonyms)) dictAntonyms.push(...d.antonyms);
    }
  }

  const datamuseSyns = Array.isArray(synData) ? synData.map((x) => x.word).filter(Boolean) : [];
  const partOfSpeech = customMeta.partOfSpeech || primaryMeaning.partOfSpeech || 'word';
  const noteText = customMeta.note || '';
  const wordFamily = deriveWordFamily(cleanWord, partOfSpeech, noteText);

  wordFamily.synonyms = [...new Set([...wordFamily.synonyms, ...dictSynonyms, ...datamuseSyns])].slice(0, 6);
  wordFamily.antonyms = [...new Set([...wordFamily.antonyms, ...dictAntonyms])].slice(0, 6);

  const datamuseCollocations = Array.isArray(collData)
    ? collData.slice(0, 4).map((c) => ({
        phrase: `${cleanWord} ${c.word}`,
        meaningVi: 'Kết hợp từ hay gặp (Datamuse)',
        example: '',
      }))
    : [];

  const noteCollocations = extractCollocationsFromNotes(cleanWord, noteText, customMeta.example || dictExamples[0]);
  const collocations = [...noteCollocations, ...datamuseCollocations].slice(0, 5);

  const examples = [
    ...(customMeta.example ? [customMeta.example] : []),
    ...(contextSentence ? [contextSentence] : []),
    ...dictExamples,
  ]
    .filter(Boolean)
    .slice(0, 3);

  const finalMeaningVi = customMeta.meaningVi || translatedVi || primaryDef.definition || cleanWord;

  return {
    word: cleanWord,
    ipa: customMeta.ipa || ipaFound || '',
    partOfSpeech: normalizePos(partOfSpeech),
    register: customMeta.topic || 'General',
    topic: customMeta.topic || 'Chung',
    status: customMeta.status || 'Đang học',
    difficulty: customMeta.difficulty || 'Trung bình (B2)',
    note: noteText,
    meaningVi: finalMeaningVi,
    meaningEn: primaryDef.definition || '',
    wordFamily,
    collocations,
    examples: examples.length > 0 ? examples : [`Try using "${cleanWord}" in your daily work context.`],
    writingPrompt:
      noteText
        ? `Viết 1 câu với "${cleanWord}" (${finalMeaningVi}). Lưu ý: ${noteText}.`
        : `Viết 1 câu thực tế dùng "${cleanWord}" (${finalMeaningVi}).`,
  };
}

function applyLanguageToolCorrections(text, matches = []) {
  if (!Array.isArray(matches) || matches.length === 0) return text;
  const sorted = [...matches]
    .filter((m) => Array.isArray(m.replacements) && m.replacements.length > 0)
    .sort((a, b) => b.offset - a.offset);

  let result = text;
  let lastAppliedEnd = Infinity;
  for (const m of sorted) {
    const start = m.offset;
    const end = m.offset + m.length;
    if (end > lastAppliedEnd) continue;
    const replacement = m.replacements[0].value;
    result = result.slice(0, start) + replacement + result.slice(end);
    lastAppliedEnd = start;
  }
  return result;
}

function runLocalGrammarFallback(sentence) {
  const errors = [];
  let fixed = sentence.trim();
  if (fixed && /^[a-z]/.test(fixed)) {
    errors.push({
      original: fixed[0],
      correction: fixed[0].toUpperCase(),
      rule: 'Capitalization',
      explanationVi: 'Chữ cái đầu câu tiếng Anh cần viết hoa.',
    });
    fixed = fixed[0].toUpperCase() + fixed.slice(1);
  }
  if (fixed && !/[.!?]$/.test(fixed)) {
    errors.push({
      original: fixed.slice(-6),
      correction: `${fixed.slice(-6)}.`,
      rule: 'Punctuation',
      explanationVi: 'Cuối câu trần thuật nên có dấu chấm (.) hoặc dấu câu kết thúc.',
    });
    fixed = `${fixed}.`;
  }
  if (/\bi\b/.test(fixed)) {
    errors.push({
      original: 'i',
      correction: 'I',
      rule: 'Pronoun Capitalization',
      explanationVi: 'Đại từ ngôi thứ nhất "I" luôn phải viết hoa.',
    });
    fixed = fixed.replace(/\bi\b/g, 'I');
  }
  return { corrected: fixed, errors };
}

function collectFamilyTokens(targetWord, wordInfo) {
  const tokens = new Set();
  if (targetWord) tokens.add(String(targetWord).trim().toLowerCase());
  const wf = wordInfo?.wordFamily || {};
  for (const arr of [wf.nouns, wf.verbs, wf.adjectives, wf.adverbs]) {
    for (const item of arr || []) {
      if (item?.word) tokens.add(String(item.word).trim().toLowerCase());
    }
  }
  return [...tokens].filter(Boolean);
}

/**
 * Evaluate a user's English sentence rapidly using LanguageTool API + structural heuristics.
 */
async function evaluateSentenceFast(targetWord, userSentence, wordInfo = null) {
  const raw = String(userSentence || '').trim();
  if (!raw) throw new Error('Vui lòng nhập câu tiếng Anh để chấm điểm.');

  const bodyParams = new URLSearchParams({ language: 'en-US', text: raw });
  const ltRes = await fetchJsonSafe(
    'https://api.languagetool.org/v2/check',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: bodyParams.toString(),
    },
    3500
  );

  let grammarErrors = [];
  let correctedSentence = raw;

  if (ltRes && Array.isArray(ltRes.matches)) {
    grammarErrors = ltRes.matches.slice(0, 6).map((m) => {
      const orig = raw.slice(m.offset, m.offset + m.length) || m.context?.text || '';
      const corr = m.replacements?.[0]?.value || orig;
      return {
        original: orig,
        correction: corr,
        rule: m.rule?.category?.name || m.rule?.id || 'Grammar',
        explanationVi: m.message || 'Kiểm tra lại ngữ pháp hoặc chính tả ở vị trí này.',
      };
    });
    correctedSentence = applyLanguageToolCorrections(raw, ltRes.matches);
  } else {
    const local = runLocalGrammarFallback(raw);
    grammarErrors = local.errors;
    correctedSentence = local.corrected;
  }

  // Ensure trailing punctuation on correctedSentence
  if (correctedSentence && !/[.!?]$/.test(correctedSentence)) {
    correctedSentence = `${correctedSentence}.`;
  }

  const candidateTokens = collectFamilyTokens(targetWord, wordInfo);
  const lowerSentence = raw.toLowerCase();
  let matchedToken = null;
  for (const token of candidateTokens) {
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}(?:s|es|ed|ing|d|ly)?\\b`, 'i');
    if (regex.test(lowerSentence)) {
      matchedToken = token;
      break;
    }
  }

  const isCorrectUsage = Boolean(matchedToken) || !targetWord;
  const wordCount = raw.split(/\s+/).filter(Boolean).length;
  const hasConnector = /\b(because|although|though|while|when|which|that|however|therefore|in order to|despite|since|if)\b/i.test(raw);

  let score = 0;
  if (isCorrectUsage) score += 40;
  score += Math.max(0, 40 - grammarErrors.length * 12);
  score += wordCount >= 10 ? 15 : wordCount >= 6 ? 10 : 5;
  if (hasConnector) score += 5;
  score = Math.max(10, Math.min(100, score));

  const cleanCore = correctedSentence.replace(/[.!?]+$/, '');
  const firstCollocation = wordInfo?.collocations?.[0]?.phrase;
  const otherForms = candidateTokens.filter((t) => t !== matchedToken).slice(0, 3);

  const wordFormFeedback = isCorrectUsage
    ? `Bạn đã sử dụng từ "${matchedToken || targetWord}" trong câu.${
        otherForms.length > 0 ? ` Thử biến đổi thêm sang các dạng họ từ khác như: ${otherForms.join(', ')}.` : ''
      }${wordInfo?.note ? ` Lưu ý từ Sheet: ${wordInfo.note}.` : ''}`
    : `Câu chưa chứa từ mục tiêu "${targetWord}" (hoặc các dạng họ từ: ${candidateTokens.join(', ')}). Hãy đưa từ này vào câu để ghi nhớ chủ động.`;

  return {
    score,
    isCorrectUsage,
    correctedSentence,
    grammarErrors,
    wordFormFeedback,
    upgradedVersions: {
      natural: correctedSentence,
      academic: wordCount < 8
        ? `${cleanCore}, which demonstrates a clear and proactive approach.`
        : `In practice, ${cleanCore.charAt(0).toLowerCase()}${cleanCore.slice(1)}.`,
      collocationRich:
        wordInfo?.examples?.[0] ||
        (firstCollocation ? `Teams often aim to ${firstCollocation} in daily workflows.` : correctedSentence),
    },
    encouragementVi:
      score >= 85
        ? 'Câu chuẩn xác và rõ ý. Tiếp tục mở rộng với các mệnh đề liên kết hoặc collocation.'
        : score >= 65
          ? 'Ý câu rõ ràng, chú ý sửa các lỗi được đánh dấu bên trên để tự nhiên hơn.'
          : 'Hãy kiểm tra lại việc dùng từ mục tiêu và độ dài câu hoàn chỉnh (chủ ngữ + động từ + tân ngữ).',
  };
}

function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pickDistractors(targetWord, allWords, count = 3) {
  const pool = allWords
    .map((w) => w.word)
    .filter((w) => w && w.toLowerCase() !== String(targetWord || '').toLowerCase());
  const fallbackBank = ['implement', 'streamline', 'evaluate', 'allocate', 'adaptable', 'sustainable'];
  const merged = [...new Set([...shuffleArray(pool), ...fallbackBank])];
  return merged.slice(0, count);
}

/**
 * Generate a contextual Reading Cloze passage combining words from the user's Google Sheet.
 */
function generateReadingExercise(wordsList = [], topicFilter = '') {
  if (!Array.isArray(wordsList) || wordsList.length === 0) {
    throw new Error('Kho từ vựng đang trống.');
  }

  let selected = wordsList;
  if (topicFilter) {
    const matching = wordsList.filter((w) =>
      String(w.topic || w.register || '').toLowerCase().includes(topicFilter.toLowerCase())
    );
    if (matching.length >= 2) selected = matching;
  }

  const chosen = shuffleArray(selected).slice(0, Math.min(4, selected.length));
  const topicLabel = topicFilter || chosen[0]?.topic || 'Công việc & Học thuật';

  const blankSentences = [];
  const fullSentences = [];
  const blanks = [];

  chosen.forEach((w, idx) => {
    const blankNum = idx + 1;
    const baseEx =
      w.examples?.[0] ||
      `In modern organizations, teams rely on ${w.word} to achieve better outcomes.`;
    const escaped = w.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'i');

    const masked = regex.test(baseEx)
      ? baseEx.replace(regex, `**(${blankNum}) _____**`)
      : `${baseEx} [**(${blankNum}) _____**]`;

    blankSentences.push(masked);
    fullSentences.push(baseEx);

    const distractors = pickDistractors(w.word, wordsList, 3);
    const options = shuffleArray([w.word, ...distractors]);

    blanks.push({
      index: blankNum,
      targetWord: w.word,
      partOfSpeech: w.partOfSpeech,
      meaningVi: w.meaningVi,
      hint: `Loại từ: ${w.partOfSpeech || 'word'} | Nghĩa: ${w.meaningVi}`,
      options,
      correctAnswer: w.word,
      explanationVi: `${w.word} (${w.partOfSpeech}): ${w.meaningVi}.${w.note ? ` Ghi chú: ${w.note}.` : ''}`,
    });
  });

  return {
    title: `Reading Cloze — Chủ đề: ${topicLabel}`,
    topic: topicLabel,
    passageWithBlanks: blankSentences.join(' '),
    fullPassage: fullSentences.join(' '),
    wordBank: shuffleArray(chosen.map((w) => w.word)),
    blanks,
    writingPrompt: `Đọc đoạn văn trên và viết 1 câu tóm tắt hoặc mở rộng có sử dụng ít nhất 1 từ trong nhóm: ${chosen.map((w) => w.word).join(', ')}.`,
  };
}

/**
 * Instantly generate 5-mode practice quizzes from local / Google Sheet vocabulary with zero AI latency.
 */
function generateQuizBatchFast(wordsList = [], quizType = 'mixed', count = 5) {
  if (!Array.isArray(wordsList) || wordsList.length === 0) {
    throw new Error('Kho từ vựng đang trống. Hãy thêm từ hoặc đồng bộ Google Sheet trước.');
  }

  if (quizType === 'reading_cloze') {
    const reading = generateReadingExercise(wordsList);
    const questions = reading.blanks.map((b, idx) => ({
      id: `rc-${idx + 1}`,
      type: 'reading_cloze',
      targetWord: b.targetWord,
      question: `[${reading.title}]\n\n${reading.passageWithBlanks}\n\nChọn từ đúng cho chỗ trống (${b.index}):`,
      hint: b.hint,
      options: b.options,
      correctAnswer: b.correctAnswer,
      explanationVi: b.explanationVi,
    }));
    return { questions, reading };
  }

  const targetCount = Math.max(1, Math.min(Number(count) || 5, wordsList.length * 2));
  const pool = [];
  while (pool.length < targetCount) {
    pool.push(...shuffleArray(wordsList));
  }

  const modes =
    quizType === 'mixed'
      ? ['word_form', 'multiple_choice', 'error_spot', 'sentence_transform', 'reading_cloze']
      : [quizType];

  let readingPack = null;
  const questions = [];

  for (let i = 0; i < targetCount; i += 1) {
    const w = pool[i];
    const mode = modes[i % modes.length];

    if (mode === 'reading_cloze') {
      if (!readingPack) readingPack = generateReadingExercise(wordsList);
      const b = readingPack.blanks[i % readingPack.blanks.length];
      questions.push({
        id: `q-${i + 1}`,
        type: 'reading_cloze',
        targetWord: b.targetWord,
        question: `[${readingPack.title}]\n${readingPack.passageWithBlanks}\n\nĐiền vào chỗ trống (${b.index}):`,
        hint: b.hint,
        options: b.options,
        correctAnswer: b.correctAnswer,
        explanationVi: b.explanationVi,
      });
      continue;
    }

    if (mode === 'word_form') {
      const wf = w.wordFamily || deriveWordFamily(w.word, w.partOfSpeech, w.note);
      const forms = [
        ...(wf.nouns || []).map((x) => ({ word: x.word, pos: 'Noun' })),
        ...(wf.verbs || []).map((x) => ({ word: x.word, pos: 'Verb' })),
        ...(wf.adjectives || []).map((x) => ({ word: x.word, pos: 'Adjective' })),
        ...(wf.adverbs || []).map((x) => ({ word: x.word, pos: 'Adverb' })),
      ].filter((f) => f.word);

      const distinctForms = [];
      const seen = new Set();
      for (const f of forms) {
        if (!seen.has(f.word.toLowerCase())) {
          seen.add(f.word.toLowerCase());
          distinctForms.push(f);
        }
      }

      if (distinctForms.length >= 2) {
        const answerObj = distinctForms.find((f) => f.word.toLowerCase() === w.word.toLowerCase()) || distinctForms[0];
        const stemDistractors = [`${w.word}ness`, `${w.word}ly`, `${w.word}ment`, ...distinctForms.map((f) => f.word)];
        const opts = shuffleArray([...new Set([answerObj.word, ...stemDistractors])]).slice(0, 4);
        if (!opts.includes(answerObj.word)) opts[0] = answerObj.word;

        const ex = w.examples?.[0] || `We should apply ${w.word} in this situation.`;
        const maskedEx = ex.replace(new RegExp(`\\b${w.word}\\b`, 'i'), '_____');

        questions.push({
          id: `q-${i + 1}`,
          type: 'word_form',
          targetWord: w.word,
          question: `Chọn đúng dạng từ (${answerObj.pos}) cho câu sau:\n"${maskedEx}"`,
          hint: `Nghĩa: ${w.meaningVi}${w.note ? ` | Ghi chú: ${w.note}` : ''}`,
          options: shuffleArray(opts),
          correctAnswer: answerObj.word,
          explanationVi: `Cần ${answerObj.pos} "${answerObj.word}" (${w.meaningVi}).`,
        });
        continue;
      }
    }

    if (mode === 'error_spot') {
      const baseEx = w.examples?.[0] || `Teams ${w.word} closely to finish the task.`;
      const brokenVariants = [
        { bad: `${w.word}ing`, fix: w.word, desc: 'Sai dạng động từ nguyên mẫu / chia thì' },
        { bad: `more ${w.word}`, fix: w.word, desc: 'Dư từ so sánh không phù hợp ngữ cảnh' },
      ];
      const wrongToken = brokenVariants[0].bad;
      const options = shuffleArray([
        `Sửa "${wrongToken}" thành "${w.word}"`,
        `Đổi chủ ngữ sang số nhiều`,
        `Thay dấu chấm bằng dấu hỏi`,
        `Câu đã đúng, không cần sửa`,
      ]);
      const correct = `Sửa "${wrongToken}" thành "${w.word}"`;
      const faultySentence = baseEx.replace(new RegExp(`\\b${w.word}\\b`, 'i'), wrongToken);
      const displaySentence = faultySentence === baseEx ? `She must ${wrongToken} this task carefully.` : faultySentence;

      questions.push({
        id: `q-${i + 1}`,
        type: 'error_spot',
        targetWord: w.word,
        question: `Tìm cách sửa lỗi đúng cho câu sau:\n"${displaySentence}"`,
        hint: `Chú ý dạng từ của "${w.word}" (${w.partOfSpeech || ''})`,
        options,
        correctAnswer: correct,
        explanationVi: `Dạng đúng trong ngữ cảnh là "${w.word}". Câu chuẩn: "${baseEx}"`,
      });
      continue;
    }

    if (mode === 'sentence_transform') {
      questions.push({
        id: `q-${i + 1}`,
        type: 'sentence_transform',
        targetWord: w.word,
        question: `Viết 1 câu tiếng Anh hoàn chỉnh dùng từ "${w.word}" (${w.partOfSpeech || ''}) mang nghĩa "${w.meaningVi}".`,
        hint: w.note || `Thử dùng trong chủ đề: ${w.topic || 'Công việc'}`,
        options: [],
        correctAnswer: w.examples?.[0] || `We need to ${w.word} effectively in daily work.`,
        explanationVi: `Ví dụ tham khảo: "${w.examples?.[0] || ''}". ${w.note || ''}`.trim(),
      });
      continue;
    }

    // Default: multiple_choice contextual fill-in
    const ex = w.examples?.[0] || `We discussed ${w.word} during the weekly meeting.`;
    const escaped = w.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const masked = ex.replace(new RegExp(`\\b${escaped}\\b`, 'i'), '_____');
    const distractors = pickDistractors(w.word, wordsList, 3);
    const options = shuffleArray([w.word, ...distractors]);

    questions.push({
      id: `q-${i + 1}`,
      type: 'multiple_choice',
      targetWord: w.word,
      question: `Chọn từ phù hợp nhất điền vào chỗ trống:\n"${masked === ex ? `${ex} (Nghĩa: ${w.meaningVi})` : masked}"`,
      hint: `Từ loại: ${w.partOfSpeech || 'word'} | Nghĩa: ${w.meaningVi}`,
      options,
      correctAnswer: w.word,
      explanationVi: `"${w.word}" có nghĩa là "${w.meaningVi}".${w.note ? ` Ghi chú: ${w.note}.` : ''}`,
    });
  }

  return { questions };
}

module.exports = {
  deriveWordFamily,
  analyzeWordFast,
  evaluateSentenceFast,
  generateReadingExercise,
  generateQuizBatchFast,
};
