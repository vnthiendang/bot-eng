const STORE_KEY = 'vocabdaily_store_v1';
const SETTINGS_KEY = 'vocabdaily_settings_v1';

const SAMPLE_SEED = {
  words: [
    {
      id: 'sample-resilient',
      word: 'resilient',
      ipa: '/rɪˈzɪl.i.ənt/',
      partOfSpeech: 'adjective',
      register: 'Formal / Versatile',
      meaningVi: 'Kiên cường, có khả năng phục hồi nhanh sau khó khăn hoặc tổn thương',
      meaningEn: 'Able to withstand or recover quickly from difficult conditions.',
      wordFamily: {
        nouns: [
          { word: 'resilience', meaningVi: 'sự kiên cường, khả năng phục hồi', example: 'Team resilience is essential during major product launches.' },
        ],
        verbs: [],
        adjectives: [
          { word: 'resilient', meaningVi: 'kiên cường, bền bỉ', example: 'She proved remarkably resilient after losing her job.' },
        ],
        adverbs: [
          { word: 'resiliently', meaningVi: 'một cách kiên cường', example: 'The coastal town rebuilt resiliently after the storm.' },
        ],
        synonyms: ['adaptable', 'tough', 'buoyant', 'hardy'],
        antonyms: ['fragile', 'vulnerable', 'brittle'],
      },
      collocations: [
        { phrase: 'economically resilient', meaningVi: 'vững vàng về mặt kinh tế', example: 'Diversified cities tend to be more economically resilient.' },
        { phrase: 'resilient mindset', meaningVi: 'tư duy kiên cường', example: 'A resilient mindset helps founders navigate setbacks.' },
        { phrase: 'build resilience', meaningVi: 'xây dựng sức chống chịu', example: 'Daily habits help you build resilience against stress.' },
      ],
      examples: [
        'Children are often more resilient than adults give them credit for.',
        'We need a resilient infrastructure capable of handling sudden traffic spikes.',
      ],
      writingPrompt: 'Viết một câu mô tả cách bản thân hoặc một hệ thống bạn biết phục hồi sau một sự cố khó khăn.',
      srs: { interval: 0, repetition: 0, efactor: 2.5, nextReviewDate: '2026-01-01T00:00:00.000Z', masteryScore: 25 },
      history: [],
    },
    {
      id: 'sample-ubiquitous',
      word: 'ubiquitous',
      ipa: '/juːˈbɪk.wɪ.təs/',
      partOfSpeech: 'adjective',
      register: 'Academic / Formal',
      meaningVi: 'Có mặt ở khắp mọi nơi, phổ biến rộng rãi',
      meaningEn: 'Present, appearing, or found everywhere.',
      wordFamily: {
        nouns: [
          { word: 'ubiquity', meaningVi: 'tính phổ biến khắp nơi', example: 'The ubiquity of smartphones has reshaped daily communication.' },
        ],
        verbs: [],
        adjectives: [
          { word: 'ubiquitous', meaningVi: 'xuất hiện khắp nơi', example: 'Coffee shops have become ubiquitous in urban neighborhoods.' },
        ],
        adverbs: [
          { word: 'ubiquitously', meaningVi: 'một cách phổ biến khắp nơi', example: 'QR codes are now used ubiquitously for payments.' },
        ],
        synonyms: ['omnipresent', 'pervasive', 'universal', 'widespread'],
        antonyms: ['rare', 'scarce', 'uncommon'],
      },
      collocations: [
        { phrase: 'become ubiquitous', meaningVi: 'trở nên phổ biến khắp nơi', example: 'Remote collaboration tools have become ubiquitous.' },
        { phrase: 'ubiquitous presence', meaningVi: 'sự hiện diện khắp nơi', example: 'The brand maintains a ubiquitous presence on social media.' },
      ],
      examples: [
        'Plastic packaging has become ubiquitous in modern supermarkets.',
        'AI assistants are now ubiquitous across developer tools.',
      ],
      writingPrompt: 'Viết một câu nói về một công nghệ hoặc thói quen hiện nay đã trở nên có mặt ở khắp mọi nơi.',
      srs: { interval: 0, repetition: 0, efactor: 2.5, nextReviewDate: '2026-01-01T00:00:00.000Z', masteryScore: 20 },
      history: [],
    },
    {
      id: 'sample-mitigate',
      word: 'mitigate',
      ipa: '/ˈmɪt.ɪ.ɡeɪt/',
      partOfSpeech: 'verb',
      register: 'Formal / Business',
      meaningVi: 'Làm giảm nhẹ, hạn chế mức độ nghiêm trọng (của rủi ro, thiệt hại)',
      meaningEn: 'To make something less harmful, unpleasant, or bad.',
      wordFamily: {
        nouns: [
          { word: 'mitigation', meaningVi: 'sự giảm nhẹ, biện pháp giảm thiểu', example: 'Risk mitigation should happen before deployment.' },
        ],
        verbs: [
          { word: 'mitigate', meaningVi: 'làm giảm nhẹ, giảm thiểu', example: 'Automated tests help mitigate regression bugs.' },
        ],
        adjectives: [
          { word: 'mitigating', meaningVi: 'có tính giảm nhẹ', example: 'The judge considered several mitigating circumstances.' },
        ],
        adverbs: [],
        synonyms: ['alleviate', 'reduce', 'lessen', 'curb'],
        antonyms: ['aggravate', 'exacerbate', 'intensify'],
      },
      collocations: [
        { phrase: 'mitigate the risk of', meaningVi: 'giảm thiểu rủi ro của việc gì', example: 'Backups mitigate the risk of permanent data loss.' },
        { phrase: 'mitigate the impact', meaningVi: 'giảm nhẹ tác động', example: 'Emergency funds mitigate the impact of sudden expenses.' },
      ],
      examples: [
        'Planting coastal mangroves helps mitigate flood damage.',
        'Clear documentation can mitigate misunderstandings between teams.',
      ],
      writingPrompt: "Viết một câu dùng 'mitigate' hoặc 'mitigation' về cách giảm thiểu rủi ro trong công việc.",
      srs: { interval: 0, repetition: 0, efactor: 2.5, nextReviewDate: '2026-01-01T00:00:00.000Z', masteryScore: 30 },
      history: [],
    },
  ],
  stats: {
    currentStreak: 0,
    longestStreak: 0,
    lastPracticeDate: null,
    totalSentencesWritten: 0,
    totalQuizzesCompleted: 0,
    dailyLog: {},
  },
};

const state = {
  store: { words: [], stats: { ...SAMPLE_SEED.stats } },
  settings: { geminiKey: '', discordWebhook: '', theme: 'dark' },
  selectedWordId: null,
  serverInfo: null,
  quizMode: 'mixed',
  quizSession: null,
};

function getTodayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function diffDays(keyA, keyB) {
  if (!keyA || !keyB) return null;
  const [y1, m1, d1] = keyA.split('-').map(Number);
  const [y2, m2, d2] = keyB.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

function showToast(msg, isError = false) {
  const el = document.getElementById('toastBanner');
  el.textContent = msg;
  el.classList.toggle('error', isError);
  el.classList.remove('hidden');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => el.classList.add('hidden'), 3600);
}

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    state.settings = { geminiKey: '', discordWebhook: '', theme: 'dark', ...saved };
  } catch {
    state.settings = { geminiKey: '', discordWebhook: '', theme: 'dark' };
  }
  document.body.setAttribute('data-theme', state.settings.theme || 'dark');
  document.getElementById('geminiKeyInput').value = state.settings.geminiKey || '';
  document.getElementById('discordWebhookInput').value = state.settings.discordWebhook || '';
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
}

function saveStore() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state.store));
  renderAll();
}

function isWordDue(word) {
  if (!word?.srs?.nextReviewDate) return true;
  const ms = new Date(word.srs.nextReviewDate).getTime();
  return Number.isNaN(ms) || ms <= Date.now();
}

function getDueWords() {
  return [...state.store.words]
    .filter(isWordDue)
    .sort((a, b) => (a.srs?.masteryScore || 0) - (b.srs?.masteryScore || 0));
}

function updateStreakLocal(activityType) {
  const today = getTodayKey();
  const s = state.store.stats;
  if (s.lastPracticeDate !== today) {
    const gap = diffDays(s.lastPracticeDate, today);
    s.currentStreak = gap === 1 ? (s.currentStreak || 0) + 1 : 1;
    s.lastPracticeDate = today;
    s.longestStreak = Math.max(s.longestStreak || 0, s.currentStreak);
  }
  s.dailyLog = s.dailyLog || {};
  const entry = { wordsAdded: 0, sentencesWritten: 0, quizzesCompleted: 0, ...(s.dailyLog[today] || {}) };
  if (activityType === 'word') entry.wordsAdded += 1;
  if (activityType === 'sentence') {
    entry.sentencesWritten += 1;
    s.totalSentencesWritten = (s.totalSentencesWritten || 0) + 1;
  }
  if (activityType === 'quiz') {
    entry.quizzesCompleted += 1;
    s.totalQuizzesCompleted = (s.totalQuizzesCompleted || 0) + 1;
  }
  s.dailyLog[today] = entry;
}

function updateSRSLocal(wordEntry, quality) {
  const q = Math.max(0, Math.min(5, Math.round(quality)));
  const cur = wordEntry.srs || { interval: 0, repetition: 0, efactor: 2.5, masteryScore: 0 };
  let rep = cur.repetition || 0;
  let interval = cur.interval || 0;
  let ef = cur.efactor || 2.5;
  let mastery = cur.masteryScore || 0;

  if (q < 3) {
    rep = 0;
    interval = 1;
    mastery = Math.max(5, mastery - 15);
  } else {
    interval = rep === 0 ? 1 : rep === 1 ? 6 : Math.round(interval * ef);
    rep += 1;
    mastery = Math.min(100, mastery + (q === 5 ? 25 : q === 4 ? 18 : 10));
  }
  ef = Math.max(1.3, Number((ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))).toFixed(2)));
  wordEntry.srs = {
    interval,
    repetition: rep,
    efactor: ef,
    nextReviewDate: new Date(Date.now() + interval * 86400000).toISOString(),
    masteryScore: mastery,
  };
}

function scoreToQuality(score) {
  if (score >= 90) return 5;
  if (score >= 78) return 4;
  if (score >= 65) return 3;
  if (score >= 45) return 2;
  return 1;
}

async function callApi(action, payload = {}) {
  const body = {
    action,
    apiKey: state.settings.geminiKey || undefined,
    webhookUrl: state.settings.discordWebhook || undefined,
    ...payload,
  };

  const res = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.ok) {
    throw new Error(json.error || `Lỗi API (${res.status})`);
  }
  return json.data;
}

async function syncLocalServerIfAvailable(endpoint, payload) {
  if (state.serverInfo?.mode !== 'local-express') return;
  try {
    await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    // Non-blocking local bot sync
  }
}

async function checkServerHealth() {
  const box = document.getElementById('serverStatusBox');
  try {
    const res = await fetch('/api/health');
    if (!res.ok) throw new Error('Vercel / Static mode');
    const info = await res.json();
    state.serverInfo = info;
    box.textContent =
      info.mode === 'local-express'
        ? `Local Express đang chạy | Gemini Env Key: ${info.hasGeminiEnvKey ? 'Đã có' : 'Chưa có'} | Discord Bot: ${info.botConfigured ? 'Đã cấu hình' : 'Chưa cấu hình'}`
        : 'Đang chạy ở chế độ Cloud / Static.';
  } catch {
    state.serverInfo = { mode: 'serverless' };
    box.textContent = 'Đang chạy ở chế độ Serverless / Trình duyệt (dữ liệu lưu tại LocalStorage).';
  }
}

async function initStore() {
  const raw = localStorage.getItem(STORE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.words)) {
        state.store = { words: parsed.words, stats: { ...SAMPLE_SEED.stats, ...(parsed.stats || {}) } };
      }
    } catch {
      state.store = JSON.parse(JSON.stringify(SAMPLE_SEED));
    }
  } else {
    // Try loading initial seed from local server if running locally
    try {
      const res = await fetch('/api/vocab');
      if (res.ok) {
        const serverStore = await res.json();
        if (Array.isArray(serverStore.words) && serverStore.words.length > 0) {
          state.store = { words: serverStore.words, stats: serverStore.stats || SAMPLE_SEED.stats };
        } else {
          state.store = JSON.parse(JSON.stringify(SAMPLE_SEED));
        }
      } else {
        state.store = JSON.parse(JSON.stringify(SAMPLE_SEED));
      }
    } catch {
      state.store = JSON.parse(JSON.stringify(SAMPLE_SEED));
    }
    localStorage.setItem(STORE_KEY, JSON.stringify(state.store));
  }

  if (state.store.words.length > 0) {
    state.selectedWordId = state.store.words[0].id;
  }
  renderAll();
}

function renderHabitBar() {
  const { words, stats } = state.store;
  const due = getDueWords();
  const mastered = words.filter((w) => (w.srs?.masteryScore || 0) >= 80).length;
  const today = getTodayKey();
  const todayLog = stats.dailyLog?.[today] || { wordsAdded: 0, sentencesWritten: 0, quizzesCompleted: 0 };

  document.getElementById('streakValue').textContent = `${stats.currentStreak || 0} ngày`;
  document.getElementById('longestStreakValue').textContent = `Kỷ lục: ${stats.longestStreak || 0}`;
  document.getElementById('totalWordsValue').textContent = String(words.length);
  document.getElementById('dueWordsValue').textContent = String(due.length);
  document.getElementById('masteredWordsValue').textContent = `Thành thạo: ${mastered}`;

  const gWord = document.getElementById('goalWord');
  const gSent = document.getElementById('goalSentence');
  const gQuiz = document.getElementById('goalQuiz');

  gWord.textContent = `+1 từ (${todayLog.wordsAdded}/1)`;
  gWord.classList.toggle('done', todayLog.wordsAdded >= 1);

  gSent.textContent = `2 câu viết (${todayLog.sentencesWritten}/2)`;
  gSent.classList.toggle('done', todayLog.sentencesWritten >= 2);

  gQuiz.textContent = `3 câu quiz (${todayLog.quizzesCompleted}/3)`;
  gQuiz.classList.toggle('done', todayLog.quizzesCompleted >= 3);
}

function renderWordBank() {
  const listEl = document.getElementById('wordBankList');
  const query = document.getElementById('wordSearchInput').value.trim().toLowerCase();
  const filter = document.getElementById('wordFilterSelect').value;

  const filtered = state.store.words.filter((w) => {
    if (filter === 'due' && !isWordDue(w)) return false;
    if (filter === 'mastered' && (w.srs?.masteryScore || 0) < 80) return false;
    if (!query) return true;
    const wf = w.wordFamily || {};
    const allForms = [
      w.word,
      w.meaningVi,
      ...(wf.nouns || []).map((x) => x.word),
      ...(wf.verbs || []).map((x) => x.word),
      ...(wf.adjectives || []).map((x) => x.word),
      ...(wf.adverbs || []).map((x) => x.word),
    ]
      .join(' ')
      .toLowerCase();
    return allForms.includes(query);
  });

  listEl.innerHTML = '';
  if (filtered.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'Không có từ nào phù hợp.';
    listEl.appendChild(empty);
    return;
  }

  for (const w of filtered) {
    const item = document.createElement('div');
    item.className = `word-item ${w.id === state.selectedWordId ? 'active' : ''}`;

    const top = document.createElement('div');
    top.className = 'word-item-top';

    const name = document.createElement('span');
    name.className = 'word-item-name';
    name.textContent = w.word;

    const delBtn = document.createElement('button');
    delBtn.className = 'delete-word-btn';
    delBtn.title = 'Xóa từ này';
    delBtn.textContent = '✕';
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      state.store.words = state.store.words.filter((x) => x.id !== w.id);
      if (state.selectedWordId === w.id) {
        state.selectedWordId = state.store.words[0]?.id || null;
      }
      saveStore();
      if (state.serverInfo?.mode === 'local-express') {
        fetch(`/api/vocab/${encodeURIComponent(w.word)}`, { method: 'DELETE' }).catch(() => {});
      }
      showToast(`Đã xóa "${w.word}"`);
    });

    top.append(name, delBtn);

    const meaning = document.createElement('div');
    meaning.className = 'word-item-meaning';
    meaning.textContent = w.meaningVi || '';

    const meta = document.createElement('div');
    meta.className = 'word-item-meta';

    const mastery = document.createElement('span');
    mastery.textContent = `Mastery: ${w.srs?.masteryScore || 0}%`;

    const dueTag = document.createElement('span');
    if (isWordDue(w)) {
      dueTag.className = 'due-tag';
      dueTag.textContent = 'Cần ôn hôm nay';
    } else {
      dueTag.textContent = `Ôn sau ${w.srs?.interval || 1} ngày`;
    }

    meta.append(mastery, dueTag);
    item.append(top, meaning, meta);
    item.addEventListener('click', () => {
      state.selectedWordId = w.id;
      renderWordBank();
      renderWordDetail();
    });
    listEl.appendChild(item);
  }
}

function renderBranchItems(containerId, items = []) {
  const el = document.getElementById(containerId);
  el.innerHTML = '';
  if (!Array.isArray(items) || items.length === 0) {
    const empty = document.createElement('span');
    empty.className = 'hint-text';
    empty.textContent = 'Không có dạng từ phổ biến';
    el.appendChild(empty);
    return;
  }

  for (const item of items) {
    const row = document.createElement('div');
    row.className = 'branch-item';

    const wordEl = document.createElement('div');
    wordEl.className = 'branch-item-word';
    wordEl.textContent = item.word || '';

    const meanEl = document.createElement('div');
    meanEl.className = 'branch-item-meaning';
    meanEl.textContent = item.meaningVi || '';

    row.append(wordEl, meanEl);
    if (item.example) {
      const exEl = document.createElement('div');
      exEl.className = 'branch-item-example';
      exEl.textContent = `"${item.example}"`;
      row.appendChild(exEl);
    }
    el.appendChild(row);
  }
}

function renderClickableWordChips(containerId, words = []) {
  const el = document.getElementById(containerId);
  el.innerHTML = '';
  if (!Array.isArray(words) || words.length === 0) {
    const empty = document.createElement('span');
    empty.className = 'hint-text';
    empty.textContent = '—';
    el.appendChild(empty);
    return;
  }

  for (const w of words) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.textContent = w;
    chip.title = `Bấm để điền "${w}" vào ô thêm từ`;
    chip.addEventListener('click', () => {
      document.getElementById('newWordInput').value = w;
      document.getElementById('newWordInput').focus();
    });
    el.appendChild(chip);
  }
}

function renderWordDetail() {
  const emptyEl = document.getElementById('wordDetailEmpty');
  const contentEl = document.getElementById('wordDetailContent');
  const word = state.store.words.find((w) => w.id === state.selectedWordId);

  if (!word) {
    emptyEl.classList.remove('hidden');
    contentEl.classList.add('hidden');
    return;
  }

  emptyEl.classList.add('hidden');
  contentEl.classList.remove('hidden');

  document.getElementById('detailWord').textContent = word.word;
  document.getElementById('detailIpa').textContent = word.ipa || '';
  document.getElementById('detailPos').textContent = word.partOfSpeech || '';
  document.getElementById('detailRegister').textContent = word.register || 'General';
  document.getElementById('detailMeaningVi').textContent = word.meaningVi || '';
  document.getElementById('detailMeaningEn').textContent = word.meaningEn || '';

  const wf = word.wordFamily || {};
  renderBranchItems('familyNouns', wf.nouns);
  renderBranchItems('familyVerbs', wf.verbs);
  renderBranchItems('familyAdjs', wf.adjectives);
  renderBranchItems('familyAdvs', wf.adverbs);

  renderClickableWordChips('familySynonyms', wf.synonyms);
  renderClickableWordChips('familyAntonyms', wf.antonyms);

  const collEl = document.getElementById('detailCollocations');
  collEl.innerHTML = '';
  for (const c of word.collocations || []) {
    const li = document.createElement('li');
    const strong = document.createElement('strong');
    strong.textContent = c.phrase;
    li.append(strong, document.createTextNode(` — ${c.meaningVi || ''}`));
    if (c.example) {
      const div = document.createElement('div');
      div.className = 'hint-text';
      div.textContent = c.example;
      li.appendChild(div);
    }
    collEl.appendChild(li);
  }

  const exEl = document.getElementById('detailExamples');
  exEl.innerHTML = '';
  for (const ex of word.examples || []) {
    const li = document.createElement('li');
    li.textContent = ex;
    exEl.appendChild(li);
  }

  document.getElementById('detailPrompt').textContent =
    word.writingPrompt || `Hãy tự đặt 1 câu thực tế sử dụng "${word.word}".`;
}

function renderWritingSelect() {
  const select = document.getElementById('writingTargetSelect');
  const currentVal = select.value || state.selectedWordId;
  select.innerHTML = '';

  const words = state.store.words;
  if (words.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'Chưa có từ nào trong kho';
    select.appendChild(opt);
    renderWritingContext();
    return;
  }

  for (const w of words) {
    const opt = document.createElement('option');
    opt.value = w.id;
    opt.textContent = `${w.word} — ${w.meaningVi}${isWordDue(w) ? ' [Cần ôn]' : ''}`;
    select.appendChild(opt);
  }

  if (words.some((w) => w.id === currentVal)) {
    select.value = currentVal;
  } else {
    select.value = words[0].id;
  }
  renderWritingContext();
}

function renderWritingContext() {
  const id = document.getElementById('writingTargetSelect').value;
  const word = state.store.words.find((w) => w.id === id);
  const chipsEl = document.getElementById('writingFamilyChips');
  const historyEl = document.getElementById('wordHistoryList');
  chipsEl.innerHTML = '';
  historyEl.innerHTML = '';

  if (!word) {
    document.getElementById('writingWordTitle').textContent = '—';
    document.getElementById('writingWordMeaning').textContent = '';
    document.getElementById('writingPromptText').textContent = 'Hãy thêm từ vựng ở Tab 1 trước.';
    return;
  }

  document.getElementById('writingWordTitle').textContent = `${word.word} (${word.partOfSpeech || ''})`;
  document.getElementById('writingWordMeaning').textContent = word.meaningVi || '';
  document.getElementById('writingPromptText').textContent =
    word.writingPrompt || `Thử thách: Viết 1 câu tự nhiên dùng "${word.word}" hoặc họ từ của nó.`;

  const wf = word.wordFamily || {};
  const forms = [
    ...(wf.nouns || []).map((x) => `${x.word} (n)`),
    ...(wf.verbs || []).map((x) => `${x.word} (v)`),
    ...(wf.adjectives || []).map((x) => `${x.word} (adj)`),
    ...(wf.adverbs || []).map((x) => `${x.word} (adv)`),
    ...(word.collocations || []).slice(0, 3).map((c) => c.phrase),
  ];

  for (const label of forms) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.textContent = label;
    chip.addEventListener('click', () => {
      const cleanToken = label.replace(/\s*\((n|v|adj|adv)\)$/, '');
      const box = document.getElementById('userSentenceInput');
      box.value = box.value ? `${box.value.trimEnd()} ${cleanToken}` : cleanToken;
      box.focus();
    });
    chipsEl.appendChild(chip);
  }

  const history = word.history || [];
  if (history.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'hint-text';
    empty.textContent = 'Chưa có câu nào được chấm cho từ này.';
    historyEl.appendChild(empty);
    return;
  }

  for (const h of history.slice(0, 5)) {
    const row = document.createElement('div');
    row.className = 'history-item';
    row.innerHTML = '';

    const head = document.createElement('div');
    head.style.display = 'flex';
    head.style.justifyContent = 'space-between';
    const scoreStrong = document.createElement('strong');
    scoreStrong.textContent = `Điểm: ${h.score}/100`;
    const dateSpan = document.createElement('span');
    dateSpan.className = 'hint-text';
    dateSpan.textContent = new Date(h.date).toLocaleDateString('vi-VN');
    head.append(scoreStrong, dateSpan);

    const orig = document.createElement('div');
    orig.textContent = `Gốc: ${h.userSentence}`;
    const corr = document.createElement('div');
    corr.className = 'hint-text';
    corr.textContent = `Chuẩn: ${h.correctedSentence || ''}`;

    row.append(head, orig, corr);
    historyEl.appendChild(row);
  }
}

function renderWritingEvaluation(userSentence, evaluation) {
  document.getElementById('writingFeedbackEmpty').classList.add('hidden');
  document.getElementById('writingFeedbackContent').classList.remove('hidden');

  const score = Number(evaluation.score) || 0;
  document.getElementById('scoreNumber').textContent = String(score);
  const ring = document.getElementById('scoreRing');
  ring.style.borderColor = score >= 80 ? 'var(--success)' : score >= 60 ? 'var(--warn)' : 'var(--danger)';

  const statusBadge = document.getElementById('usageStatusBadge');
  statusBadge.textContent = evaluation.isCorrectUsage
    ? 'Dùng từ đúng ngữ cảnh & ý nghĩa'
    : 'Cần điều chỉnh lại cách dùng từ mục tiêu';
  statusBadge.style.color = evaluation.isCorrectUsage ? 'var(--success)' : 'var(--warn)';

  document.getElementById('encouragementText').textContent = evaluation.encouragementVi || '';
  document.getElementById('feedbackOriginalSentence').textContent = userSentence;
  document.getElementById('feedbackCorrectedSentence').textContent = evaluation.correctedSentence || userSentence;
  document.getElementById('wordFormFeedbackText').textContent = evaluation.wordFormFeedback || '—';

  const errorsEl = document.getElementById('grammarErrorsList');
  errorsEl.innerHTML = '';
  const errors = evaluation.grammarErrors || [];
  if (errors.length === 0) {
    const ok = document.createElement('div');
    ok.className = 'hint-text';
    ok.textContent = 'Không có lỗi ngữ pháp đáng kể. Hãy xem các phiên bản nâng cấp bên dưới!';
    errorsEl.appendChild(ok);
  } else {
    for (const err of errors) {
      const card = document.createElement('div');
      card.className = 'error-item';

      const rule = document.createElement('strong');
      rule.textContent = `[${err.rule || 'Grammar'}] `;
      const diff = document.createElement('span');
      diff.textContent = `"${err.original}" -> "${err.correction}"`;
      const exp = document.createElement('div');
      exp.className = 'hint-text';
      exp.style.marginTop = '4px';
      exp.textContent = err.explanationVi || '';

      card.append(rule, diff, exp);
      errorsEl.appendChild(card);
    }
  }

  const upgradesEl = document.getElementById('upgradedVersionsList');
  upgradesEl.innerHTML = '';
  const up = evaluation.upgradedVersions || {};
  const levels = [
    { key: 'natural', label: 'Giao tiếp tự nhiên' },
    { key: 'academic', label: 'Học thuật / IELTS' },
    { key: 'collocationRich', label: 'Giàu Collocation' },
  ];

  for (const lvl of levels) {
    if (!up[lvl.key]) continue;
    const card = document.createElement('div');
    card.className = 'upgrade-card';

    const left = document.createElement('div');
    const tag = document.createElement('div');
    tag.className = 'upgrade-label';
    tag.textContent = lvl.label;
    const text = document.createElement('div');
    text.textContent = up[lvl.key];
    left.append(tag, text);

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'btn btn-ghost';
    copyBtn.textContent = 'Copy';
    copyBtn.addEventListener('click', () => {
      navigator.clipboard?.writeText(up[lvl.key]);
      showToast('Đã copy câu gợi ý!');
    });

    card.append(left, copyBtn);
    upgradesEl.appendChild(card);
  }
}

function renderQuizQuestion() {
  const s = state.quizSession;
  if (!s) return;

  document.getElementById('quizEmptyState').classList.add('hidden');
  document.getElementById('quizSummaryView').classList.add('hidden');
  document.getElementById('quizActiveView').classList.remove('hidden');

  const q = s.questions[s.index];
  const typeNames = {
    word_form: 'Biến đổi Họ từ',
    error_spot: 'Tìm lỗi sai Ngữ pháp',
    multiple_choice: 'Ngữ cảnh & Collocation',
    sentence_transform: 'Viết lại câu (Active Recall)',
  };

  document.getElementById('quizCounter').textContent = `Câu ${s.index + 1} / ${s.questions.length}`;
  document.getElementById('quizTypeBadge').textContent = typeNames[q.type] || q.type;
  document.getElementById('quizScoreLive').textContent = `Đúng: ${s.score}`;
  document.getElementById('quizTargetWord').textContent = q.targetWord || '';
  document.getElementById('quizQuestionText').textContent = q.question || '';
  document.getElementById('quizHintText').textContent = q.hint ? `Gợi ý: ${q.hint}` : '';

  const optionsGrid = document.getElementById('quizOptionsGrid');
  const transformBox = document.getElementById('quizTransformBox');
  const feedbackBox = document.getElementById('quizFeedbackBox');
  const nextBtn = document.getElementById('quizNextBtn');

  optionsGrid.innerHTML = '';
  feedbackBox.classList.add('hidden');
  nextBtn.classList.add('hidden');
  document.getElementById('quizTransformInput').value = '';

  if (Array.isArray(q.options) && q.options.length > 0) {
    transformBox.classList.add('hidden');
    optionsGrid.classList.remove('hidden');
    const labels = ['A', 'B', 'C', 'D'];

    q.options.forEach((optText, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'quiz-option-btn';
      btn.textContent = `${labels[idx] || idx + 1}. ${optText}`;
      btn.addEventListener('click', () => handleQuizChoice(idx, btn));
      optionsGrid.appendChild(btn);
    });
  } else {
    optionsGrid.classList.add('hidden');
    transformBox.classList.remove('hidden');
  }
}

function finishQuizStep(isCorrect, explanationHtml) {
  const s = state.quizSession;
  const q = s.questions[s.index];
  if (isCorrect) s.score += 1;

  const entry = state.store.words.find(
    (w) => w.word.toLowerCase() === String(q.targetWord || '').toLowerCase()
  );
  if (entry) {
    updateSRSLocal(entry, isCorrect ? 4 : 1);
  }
  updateStreakLocal('quiz');
  saveStore();
  syncLocalServerIfAvailable('/api/vocab/record-quiz', { targetWord: q.targetWord, isCorrect });

  document.getElementById('quizScoreLive').textContent = `Đúng: ${s.score}`;
  const feedbackBox = document.getElementById('quizFeedbackBox');
  feedbackBox.textContent = explanationHtml;
  feedbackBox.classList.remove('hidden');

  const nextBtn = document.getElementById('quizNextBtn');
  nextBtn.textContent = s.index + 1 < s.questions.length ? 'Câu tiếp theo' : 'Xem tổng kết';
  nextBtn.classList.remove('hidden');
}

function handleQuizChoice(chosenIdx) {
  const s = state.quizSession;
  if (!s || s.answeredCurrent) return;
  s.answeredCurrent = true;

  const q = s.questions[s.index];
  const chosen = q.options[chosenIdx];
  const isCorrect =
    String(chosen || '').trim().toLowerCase() === String(q.correctAnswer || '').trim().toLowerCase();

  const buttons = document.querySelectorAll('.quiz-option-btn');
  buttons.forEach((btn, idx) => {
    btn.disabled = true;
    const optVal = String(q.options[idx] || '').trim().toLowerCase();
    if (optVal === String(q.correctAnswer || '').trim().toLowerCase()) {
      btn.classList.add('correct');
    } else if (idx === chosenIdx && !isCorrect) {
      btn.classList.add('wrong');
    }
  });

  const prefix = isCorrect ? 'Chính xác! ' : `Chưa đúng (Đáp án: ${q.correctAnswer}). `;
  finishQuizStep(isCorrect, `${prefix}${q.explanationVi || ''}`);
}

function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  document.querySelectorAll('.tab-panel').forEach((panel) => {
    panel.classList.toggle('active', panel.id === `tab-${tabName}`);
  });
}

function renderAll() {
  renderHabitBar();
  renderWordBank();
  renderWordDetail();
  renderWritingSelect();
}

function bindEvents() {
  // Tab switching
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Theme toggle
  document.getElementById('themeToggleBtn').addEventListener('click', () => {
    const next = document.body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', next);
    state.settings.theme = next;
    saveSettings();
  });

  // Search & Filter
  document.getElementById('wordSearchInput').addEventListener('input', renderWordBank);
  document.getElementById('wordFilterSelect').addEventListener('change', renderWordBank);
  document.getElementById('writingTargetSelect').addEventListener('change', renderWritingContext);

  // Add & Analyze Word
  document.getElementById('addWordForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const word = document.getElementById('newWordInput').value.trim();
    const contextSentence = document.getElementById('newWordContextInput').value.trim();
    if (!word) return;

    const btn = document.getElementById('analyzeWordBtn');
    btn.disabled = true;
    btn.textContent = 'Đang phân tích...';

    try {
      const analyzed = await callApi('analyze', { word, contextSentence });
      const existingIdx = state.store.words.findIndex(
        (w) => w.word.toLowerCase() === String(analyzed.word || word).toLowerCase()
      );

      let entry;
      if (existingIdx >= 0) {
        entry = { ...state.store.words[existingIdx], ...analyzed };
        state.store.words[existingIdx] = entry;
      } else {
        entry = {
          id: `w-${Date.now().toString(36)}`,
          ...analyzed,
          srs: { interval: 0, repetition: 0, efactor: 2.5, nextReviewDate: new Date().toISOString(), masteryScore: 0 },
          history: [],
          createdAt: new Date().toISOString(),
        };
        state.store.words.unshift(entry);
        updateStreakLocal('word');
      }

      state.selectedWordId = entry.id;
      saveStore();
      syncLocalServerIfAvailable('/api/vocab/upsert', entry);

      document.getElementById('newWordInput').value = '';
      document.getElementById('newWordContextInput').value = '';
      showToast(`Đã phân tích và lưu "${entry.word}"!`);
    } catch (err) {
      showToast(err.message, true);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Phân tích & Lưu từ';
    }
  });

  // Quick jump buttons from word detail
  document.getElementById('practiceSelectedWordBtn').addEventListener('click', () => {
    switchTab('writing');
    if (state.selectedWordId) {
      document.getElementById('writingTargetSelect').value = state.selectedWordId;
      renderWritingContext();
    }
  });

  document.getElementById('quizSelectedWordBtn').addEventListener('click', () => {
    const word = state.store.words.find((w) => w.id === state.selectedWordId);
    if (!word) return;
    switchTab('quiz');
    startQuizSession([word], state.quizMode);
  });

  document.getElementById('pickDueWordBtn').addEventListener('click', () => {
    const due = getDueWords();
    const target = due[0] || state.store.words[0];
    if (!target) return showToast('Kho từ đang trống.', true);
    document.getElementById('writingTargetSelect').value = target.id;
    renderWritingContext();
    showToast(`Đã chọn từ cần ôn: ${target.word}`);
  });

  document.getElementById('clearSentenceBtn').addEventListener('click', () => {
    document.getElementById('userSentenceInput').value = '';
  });

  // Evaluate Sentence
  document.getElementById('evaluateSentenceForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const wordId = document.getElementById('writingTargetSelect').value;
    const wordEntry = state.store.words.find((w) => w.id === wordId);
    const userSentence = document.getElementById('userSentenceInput').value.trim();
    if (!wordEntry || !userSentence) return;

    const btn = document.getElementById('evaluateBtn');
    btn.disabled = true;
    btn.textContent = 'Đang chấm & phân tích...';

    try {
      const evaluation = await callApi('evaluate', {
        targetWord: wordEntry.word,
        userSentence,
        wordInfo: wordEntry,
      });

      updateSRSLocal(wordEntry, scoreToQuality(evaluation.score));
      wordEntry.history = wordEntry.history || [];
      wordEntry.history.unshift({
        date: new Date().toISOString(),
        userSentence,
        score: evaluation.score,
        correctedSentence: evaluation.correctedSentence,
        isCorrectUsage: evaluation.isCorrectUsage,
      });
      wordEntry.history = wordEntry.history.slice(0, 20);

      updateStreakLocal('sentence');
      saveStore();
      syncLocalServerIfAvailable('/api/vocab/record-sentence', {
        wordIdOrName: wordEntry.word,
        evaluation,
        userSentence,
      });

      renderWritingEvaluation(userSentence, evaluation);
      renderWritingContext();
      showToast(`Hoàn thành! Điểm: ${evaluation.score}/100`);
    } catch (err) {
      showToast(err.message, true);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Chấm điểm & Sửa lỗi ngữ pháp';
    }
  });

  // Quiz Mode selection & start
  document.querySelectorAll('.mode-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mode-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state.quizMode = btn.dataset.mode;
    });
  });

  document.getElementById('startQuizBtn').addEventListener('click', () => {
    const due = getDueWords();
    const pool = due.length > 0 ? due.slice(0, 6) : state.store.words.slice(0, 6);
    startQuizSession(pool, state.quizMode);
  });

  document.getElementById('quizRestartBtn').addEventListener('click', () => {
    const due = getDueWords();
    const pool = due.length > 0 ? due.slice(0, 6) : state.store.words.slice(0, 6);
    startQuizSession(pool, state.quizMode);
  });

  document.getElementById('quizNextBtn').addEventListener('click', () => {
    const s = state.quizSession;
    if (!s) return;
    s.index += 1;
    s.answeredCurrent = false;
    if (s.index < s.questions.length) {
      renderQuizQuestion();
    } else {
      document.getElementById('quizActiveView').classList.add('hidden');
      document.getElementById('quizSummaryView').classList.remove('hidden');
      document.getElementById('quizSummaryText').textContent =
        `Bạn trả lời đúng ${s.score}/${s.questions.length} câu. Lịch ôn tập Spaced Repetition và Streak đã được cập nhật!`;
    }
  });

  document.getElementById('quizCheckTransformBtn').addEventListener('click', async () => {
    const s = state.quizSession;
    const q = s?.questions?.[s.index];
    const answer = document.getElementById('quizTransformInput').value.trim();
    if (!q || !answer) return;

    const btn = document.getElementById('quizCheckTransformBtn');
    btn.disabled = true;
    btn.textContent = 'Đang chấm...';
    try {
      const evaluation = await callApi('evaluate', {
        targetWord: q.targetWord,
        userSentence: answer,
      });
      const passed = (evaluation.score || 0) >= 65;
      finishQuizStep(
        passed,
        `Điểm AI: ${evaluation.score}/100. Câu chuẩn: "${evaluation.correctedSentence}". Đáp án mẫu: "${q.correctAnswer}". ${q.explanationVi || ''}`
      );
    } catch (err) {
      showToast(err.message, true);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Chấm với Gemini AI';
    }
  });

  document.getElementById('quizRevealTransformBtn').addEventListener('click', () => {
    const s = state.quizSession;
    const q = s?.questions?.[s.index];
    if (!q || s.answeredCurrent) return;
    s.answeredCurrent = true;
    finishQuizStep(false, `Đáp án mẫu: "${q.correctAnswer}". ${q.explanationVi || ''}`);
  });

  // Discord Webhook button
  async function triggerDiscordWebhook(customMessage = '') {
    const due = getDueWords();
    const list = due.length > 0 ? due : state.store.words;
    try {
      await callApi('discordWebhook', {
        words: list,
        stats: state.store.stats,
        customMessage,
      });
      showToast('Đã gửi thẻ nhắc học sang Discord!');
    } catch (err) {
      showToast(err.message, true);
    }
  }

  document.getElementById('sendDiscordBtn').addEventListener('click', () => triggerDiscordWebhook());
  document.getElementById('testWebhookBtn').addEventListener('click', () =>
    triggerDiscordWebhook('Kiểm tra kết nối VocabDaily -> Discord thành công! Bắt đầu giữ Streak mỗi ngày nhé.')
  );

  // Settings save
  document.getElementById('settingsForm').addEventListener('submit', (e) => {
    e.preventDefault();
    state.settings.geminiKey = document.getElementById('geminiKeyInput').value.trim();
    state.settings.discordWebhook = document.getElementById('discordWebhookInput').value.trim();
    saveSettings();
    showToast('Đã lưu cấu hình trên trình duyệt!');
  });

  // JSON Export & Import
  document.getElementById('exportJsonBtn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state.store, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vocab-daily-backup-${getTodayKey()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Đã tải xuống file sao lưu JSON.');
  });

  document.getElementById('importJsonInput').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed.words)) {
        throw new Error('File JSON không đúng định dạng VocabDaily.');
      }
      const byWord = new Map(state.store.words.map((w) => [w.word.toLowerCase(), w]));
      for (const incoming of parsed.words) {
        if (incoming?.word) byWord.set(incoming.word.toLowerCase(), incoming);
      }
      state.store.words = Array.from(byWord.values());
      if (parsed.stats) {
        state.store.stats = { ...state.store.stats, ...parsed.stats };
      }
      state.selectedWordId = state.store.words[0]?.id || null;
      saveStore();
      showToast(`Đã nhập thành công ${parsed.words.length} từ!`);
    } catch (err) {
      showToast(err.message, true);
    } finally {
      e.target.value = '';
    }
  });

  // Local Discord Bot Server Sync
  document.getElementById('syncFromServerBtn').addEventListener('click', async () => {
    try {
      const res = await fetch('/api/vocab');
      if (!res.ok) throw new Error('Server local không khả dụng.');
      const data = await res.json();
      state.store = { words: data.words || [], stats: data.stats || SAMPLE_SEED.stats };
      state.selectedWordId = state.store.words[0]?.id || null;
      saveStore();
      showToast('Đã đồng bộ dữ liệu từ Discord Bot local!');
    } catch (err) {
      showToast(err.message, true);
    }
  });

  document.getElementById('pushToServerBtn').addEventListener('click', async () => {
    try {
      const res = await fetch('/api/vocab/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: state.store, mode: 'merge' }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || 'Không thể đồng bộ.');
      showToast('Đã đẩy dữ liệu sang kho của Discord Bot local!');
    } catch (err) {
      showToast(err.message, true);
    }
  });

  document.getElementById('resetSampleBtn').addEventListener('click', () => {
    state.store = JSON.parse(JSON.stringify(SAMPLE_SEED));
    state.selectedWordId = state.store.words[0].id;
    saveStore();
    showToast('Đã nạp lại 3 từ vựng mẫu.');
  });
}

async function startQuizSession(wordsPool, mode) {
  if (!wordsPool || wordsPool.length === 0) {
    showToast('Kho từ đang trống. Hãy thêm ít nhất 1 từ trước.', true);
    return;
  }

  const btn = document.getElementById('startQuizBtn');
  btn.disabled = true;
  btn.textContent = 'Đang tạo bài tập...';

  try {
    const data = await callApi('quiz', { wordsList: wordsPool, quizType: mode, count: 5 });
    if (!Array.isArray(data.questions) || data.questions.length === 0) {
      throw new Error('Không tạo được câu hỏi, vui lòng thử lại.');
    }
    state.quizSession = {
      questions: data.questions,
      index: 0,
      score: 0,
      answeredCurrent: false,
    };
    renderQuizQuestion();
  } catch (err) {
    showToast(err.message, true);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Tạo bộ 5 bài tập mới';
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  loadSettings();
  bindEvents();
  await checkServerHealth();
  await initStore();
});
