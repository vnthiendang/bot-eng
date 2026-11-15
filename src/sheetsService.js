const fs = require('fs');
const os = require('os');
const path = require('path');

const { deriveWordFamily } = require('./fastEngine');
const { createWordEntry } = require('./srsService');
const { loadStore, saveStore, isReadOnlyRuntime, getDefaultStorePath } = require('./storageService');

const DEFAULT_SPREADSHEET_ID =
  process.env.SPREADSHEET_ID || '1nurVhcDCa_-xJj7fmVNfAuwJyRHNXZEnhCBcOyIYY5g';

const LOCAL_CLIENT_FALLBACK =
  'd:\\downloads\\client_secret_203308633278-h99r85ei13iq4buv45td1cl47atcg86k.apps.googleusercontent.com.json';

function getSpreadsheetUrl(spreadsheetId = DEFAULT_SPREADSHEET_ID) {
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit?usp=sharing`;
}

function getTokenPath() {
  if (isReadOnlyRuntime()) {
    return path.join(os.tmpdir(), 'vocab-daily-google-token.json');
  }
  return path.join(__dirname, '..', 'data', 'google-token.json');
}

function loadGoogleOAuthConfig() {
  const envId = (process.env.GOOGLE_CLIENT_ID || '').trim();
  const envSecret = (process.env.GOOGLE_CLIENT_SECRET || '').trim();
  const envRedirect = (process.env.GOOGLE_REDIRECT_URI || '').trim();

  if (envId && envSecret) {
    return {
      clientId: envId,
      clientSecret: envSecret,
      redirectUri: envRedirect || 'https://antigravity.google/oauth-callback',
    };
  }

  const candidateFiles = [
    path.join(__dirname, '..', 'config', 'google-oauth-client.json'),
    LOCAL_CLIENT_FALLBACK,
  ];

  for (const filePath of candidateFiles) {
    try {
      if (fs.existsSync(filePath)) {
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const block = parsed.web || parsed.installed || parsed;
        if (block?.client_id && block?.client_secret) {
          return {
            clientId: block.client_id,
            clientSecret: block.client_secret,
            redirectUri: envRedirect || block.redirect_uris?.[0] || 'https://antigravity.google/oauth-callback',
          };
        }
      }
    } catch {
      // Ignore unreadable candidate file
    }
  }

  return null;
}

function getGoogleAuthUrl(state = 'vocab-daily') {
  const cfg = loadGoogleOAuthConfig();
  if (!cfg) {
    throw new Error('Chưa cấu hình Google OAuth Client ID/Secret.');
  }
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    access_type: 'offline',
    prompt: 'consent',
    state,
  });
  return `https://accounts.google.com/o/oauth2/auth?${params.toString()}`;
}

function loadSavedGoogleTokens() {
  if (process.env.GOOGLE_REFRESH_TOKEN) {
    return {
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN.trim(),
      access_token: (process.env.GOOGLE_ACCESS_TOKEN || '').trim(),
      expiry_date: 0,
    };
  }
  try {
    const p = getTokenPath();
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf8'));
    }
  } catch {
    return null;
  }
  return null;
}

function saveGoogleTokens(tokens) {
  try {
    const p = getTokenPath();
    const dir = path.dirname(p);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(p, JSON.stringify(tokens, null, 2), 'utf8');
  } catch {
    // Non-fatal in read-only runtimes
  }
  return tokens;
}

async function exchangeCodeForTokens(code) {
  const cfg = loadGoogleOAuthConfig();
  if (!cfg) throw new Error('Thiếu cấu hình Google OAuth Client.');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: String(code || '').trim(),
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      redirect_uri: cfg.redirectUri,
      grant_type: 'authorization_code',
    }).toString(),
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error_description || data.error || 'Không thể đổi mã OAuth lấy token.');
  }
  const stored = {
    ...data,
    expiry_date: Date.now() + (Number(data.expires_in) || 3600) * 1000,
  };
  return saveGoogleTokens(stored);
}

async function getValidAccessToken() {
  const tokens = loadSavedGoogleTokens();
  if (!tokens) return null;
  if (tokens.access_token && tokens.expiry_date && tokens.expiry_date > Date.now() + 60000) {
    return tokens.access_token;
  }
  if (!tokens.refresh_token) return tokens.access_token || null;

  const cfg = loadGoogleOAuthConfig();
  if (!cfg) return null;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      refresh_token: tokens.refresh_token,
      grant_type: 'refresh_token',
    }).toString(),
  });
  const refreshed = await res.json().catch(() => ({}));
  if (!res.ok || !refreshed.access_token) return null;

  const updated = {
    ...tokens,
    ...refreshed,
    expiry_date: Date.now() + (Number(refreshed.expires_in) || 3600) * 1000,
  };
  saveGoogleTokens(updated);
  return updated.access_token;
}

/**
 * RFC-4180 compliant CSV parser handling quoted commas and escaped quotes.
 */
function parseCsv(csvText = '') {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  const text = String(csvText || '').replace(/^\uFEFF/, '');

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell.trim());
      cell = '';
    } else if (ch === '\r' && next === '\n') {
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = '';
      i += 1;
    } else if (ch === '\n' || ch === '\r') {
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell.trim());
    rows.push(row);
  }
  return rows;
}

function mapStatusToSrs(statusText = '') {
  const lower = String(statusText || '').toLowerCase();
  const pastDue = '2026-01-01T00:00:00.000Z';
  const futureDue = new Date(Date.now() + 14 * 86400000).toISOString();

  if (lower.includes('đã thuộc')) {
    return { interval: 14, repetition: 3, efactor: 2.6, nextReviewDate: futureDue, masteryScore: 85 };
  }
  if (lower.includes('cần ôn')) {
    return { interval: 0, repetition: 0, efactor: 2.5, nextReviewDate: pastDue, masteryScore: 20 };
  }
  return { interval: 1, repetition: 1, efactor: 2.5, nextReviewDate: pastDue, masteryScore: 50 };
}

function extractCollocationsFromNote(word, note = '', example = '') {
  const collocations = [];
  const text = String(note || '');
  let m;
  if ((m = text.match(/(?:thường\s*)?đi\s*với\s+([^.;\n]+)/i))) {
    const items = m[1].split(/[,/]/).map((x) => x.trim()).filter(Boolean);
    for (const part of items) {
      collocations.push({
        phrase: `${word} ${part}`.trim(),
        meaningVi: 'Cụm kết hợp từ ghi chú trên Sheet',
        example,
      });
    }
  }
  if ((m = text.match(/động\s*từ\s*:\s*([a-zA-Z\s]+)/i))) {
    collocations.push({
      phrase: m[1].trim(),
      meaningVi: 'Dạng động từ kết hợp trong ghi chú',
      example,
    });
  }
  return collocations;
}

/**
 * Parse rows exported from the user's Google Spreadsheet.
 */
function parseSheetRows(csvText) {
  const rows = parseCsv(csvText);
  const headerIdx = rows.findIndex((r) =>
    r.some((cell) => /^từ\s*vựng$/i.test(cell.trim()))
  );

  if (headerIdx === -1) {
    throw new Error('Không tìm thấy cột tiêu đề "Từ vựng" trong Google Sheet.');
  }

  const header = rows[headerIdx].map((h) => h.toLowerCase());
  const col = {
    word: header.findIndex((h) => h.includes('từ vựng')),
    ipa: header.findIndex((h) => h.includes('phiên âm') || h.includes('ipa')),
    pos: header.findIndex((h) => h.includes('từ loại')),
    meaning: header.findIndex((h) => h.includes('nghĩa')),
    topic: header.findIndex((h) => h.includes('chủ đề')),
    example: header.findIndex((h) => h.includes('ví dụ')),
    status: header.findIndex((h) => h.includes('trạng thái')),
    difficulty: header.findIndex((h) => h.includes('độ khó')),
    note: header.findIndex((h) => h.includes('ghi chú')),
  };

  const words = [];
  for (let i = headerIdx + 1; i < rows.length; i += 1) {
    const r = rows[i];
    const word = (r[col.word] || '').trim();
    if (!word) continue;

    const ipa = col.ipa >= 0 ? (r[col.ipa] || '').trim() : '';
    const partOfSpeech = col.pos >= 0 ? (r[col.pos] || '').trim() : '';
    const meaningVi = col.meaning >= 0 ? (r[col.meaning] || '').trim() : '';
    const topic = col.topic >= 0 ? (r[col.topic] || '').trim() : 'Chung';
    const example = col.example >= 0 ? (r[col.example] || '').trim() : '';
    const status = col.status >= 0 ? (r[col.status] || '').trim() : 'Đang học';
    const difficulty = col.difficulty >= 0 ? (r[col.difficulty] || '').trim() : '';
    const note = col.note >= 0 ? (r[col.note] || '').trim() : '';

    const wordFamily = deriveWordFamily(word, partOfSpeech, note);
    const collocations = extractCollocationsFromNote(word, note, example);

    words.push(
      createWordEntry({
        id: `sheet-${word.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        word,
        ipa,
        partOfSpeech: partOfSpeech.toLowerCase(),
        register: topic || 'General',
        topic: topic || 'Chung',
        status: status || 'Đang học',
        difficulty,
        note,
        source: 'google-sheet',
        meaningVi,
        meaningEn: '',
        wordFamily,
        collocations,
        examples: example ? [example] : [],
        writingPrompt: note
          ? `Viết 1 câu chủ đề "${topic}" với "${word}". Lưu ý: ${note}.`
          : `Viết 1 câu chủ đề "${topic}" dùng từ "${word}" (${meaningVi}).`,
        srs: mapStatusToSrs(status),
      })
    );
  }

  const total = words.length;
  const mastered = words.filter((w) => w.status.toLowerCase().includes('đã thuộc')).length;
  const needReview = words.filter((w) => w.status.toLowerCase().includes('cần ôn')).length;
  const learning = total - mastered - needReview;
  const completionRate = total > 0 ? `${((mastered / total) * 100).toFixed(1)}%` : '0%';

  return {
    words,
    summary: { total, mastered, learning, needReview, completionRate },
  };
}

async function fetchSheetWords(spreadsheetId = DEFAULT_SPREADSHEET_ID) {
  const url = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(spreadsheetId)}/export?format=csv`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Không tải được Google Sheet (HTTP ${res.status}). Hãy đảm bảo Sheet đang bật quyền xem "Anyone with the link".`);
  }
  const csvText = await res.text();
  return parseSheetRows(csvText);
}

/**
 * Sync vocabulary from Google Spreadsheet into the local JSON store.
 */
async function syncWithGoogleSheet(storePath = getDefaultStorePath(), spreadsheetId = DEFAULT_SPREADSHEET_ID) {
  const { words: sheetWords, summary } = await fetchSheetWords(spreadsheetId);
  const store = loadStore(storePath);

  const byWord = new Map();
  for (const existing of store.words || []) {
    byWord.set(String(existing.word || '').toLowerCase(), existing);
  }

  for (const sw of sheetWords) {
    const key = sw.word.toLowerCase();
    const existing = byWord.get(key);
    if (existing) {
      byWord.set(key, {
        ...existing,
        ...sw,
        id: existing.id || sw.id,
        history: existing.history || [],
        srs: existing.history?.length > 0 ? existing.srs : sw.srs,
      });
    } else {
      byWord.set(key, sw);
    }
  }

  const nextStore = {
    words: Array.from(byWord.values()),
    stats: {
      ...store.stats,
      lastSheetSyncAt: new Date().toISOString(),
    },
  };
  saveStore(nextStore, storePath);

  return {
    words: nextStore.words,
    stats: nextStore.stats,
    summary,
    spreadsheetUrl: getSpreadsheetUrl(spreadsheetId),
  };
}

/**
 * Append or update a vocabulary row in Google Sheets via Apps Script Webhook or Google OAuth2 API v4.
 */
async function appendOrUpdateSheetRow(wordEntry, spreadsheetId = DEFAULT_SPREADSHEET_ID) {
  const appsScriptUrl = (process.env.GOOGLE_APPS_SCRIPT_URL || '').trim();
  const rowValues = [
    wordEntry.word || '',
    wordEntry.ipa || '',
    wordEntry.partOfSpeech || '',
    wordEntry.meaningVi || '',
    wordEntry.topic || wordEntry.register || 'Chung',
    wordEntry.examples?.[0] || '',
    wordEntry.status || 'Đang học',
    wordEntry.difficulty || 'Trung bình (B2)',
    wordEntry.note || '',
  ];

  if (appsScriptUrl) {
    const res = await fetch(appsScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spreadsheetId, row: rowValues }),
    });
    if (!res.ok) {
      throw new Error(`Apps Script lỗi HTTP ${res.status}`);
    }
    return { syncedToSheet: true, method: 'apps-script' };
  }

  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    let authUrl = '';
    try {
      authUrl = getGoogleAuthUrl();
    } catch {
      authUrl = '';
    }
    return { syncedToSheet: false, reason: 'oauth_token_missing', authUrl };
  }

  // Check if word already exists in column B (rows 8..500)
  const getUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/B8:B500`;
  const listRes = await fetch(getUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!listRes.ok) {
    const errBody = await listRes.text().catch(() => '');
    throw new Error(`Google Sheets API lỗi (${listRes.status}): ${errBody}`);
  }

  const listData = await listRes.json();
  const rows = Array.isArray(listData.values) ? listData.values : [];
  const targetLower = String(wordEntry.word || '').trim().toLowerCase();
  const existingOffset = rows.findIndex((r) => String(r?.[0] || '').trim().toLowerCase() === targetLower);

  if (existingOffset >= 0) {
    const rowNumber = 8 + existingOffset;
    const putUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/B${rowNumber}:J${rowNumber}?valueInputOption=USER_ENTERED`;
    const putRes = await fetch(putUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: [rowValues] }),
    });
    if (!putRes.ok) throw new Error(`Không cập nhật được dòng ${rowNumber} trên Sheet.`);
    return { syncedToSheet: true, method: 'google-oauth-v4', action: 'updated', rowNumber };
  }

  const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/B8:J8:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  const appendRes = await fetch(appendUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values: [rowValues] }),
  });
  if (!appendRes.ok) throw new Error(`Không thêm được từ mới lên Sheet (HTTP ${appendRes.status}).`);
  return { syncedToSheet: true, method: 'google-oauth-v4', action: 'appended' };
}

module.exports = {
  DEFAULT_SPREADSHEET_ID,
  getSpreadsheetUrl,
  loadGoogleOAuthConfig,
  getGoogleAuthUrl,
  exchangeCodeForTokens,
  getValidAccessToken,
  parseCsv,
  parseSheetRows,
  fetchSheetWords,
  syncWithGoogleSheet,
  appendOrUpdateSheetRow,
};
