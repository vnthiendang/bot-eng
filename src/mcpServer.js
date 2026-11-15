const readline = require('readline');
const path = require('path');

// Redirect console.log to stderr so stray module logs never corrupt stdio JSON-RPC frames.
console.log = (...args) => {
  process.stderr.write(`${args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')}\n`);
};

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const {
  analyzeWordFast,
  evaluateSentenceFast,
  generateReadingExercise,
} = require('./fastEngine');
const {
  DEFAULT_SPREADSHEET_ID,
  syncWithGoogleSheet,
  appendOrUpdateSheetRow,
  getGoogleAuthUrl,
} = require('./sheetsService');
const {
  getDefaultStorePath,
  loadStore,
  upsertWord,
} = require('./storageService');

const SERVER_INFO = {
  name: 'vocab-daily-sheets-mcp',
  version: '2.0.0',
};

const PROTOCOL_VERSION = '2024-11-05';

const TOOLS = [
  {
    name: 'sheets_sync_vocab',
    description:
      'Đồng bộ danh sách từ vựng, trạng thái ôn tập, độ khó và ghi chú từ Google Spreadsheet về kho học tập.',
    inputSchema: {
      type: 'object',
      properties: {
        spreadsheetId: {
          type: 'string',
          description: 'Google Spreadsheet ID (mặc định dùng bảng theo dõi đã cấu hình).',
        },
      },
    },
  },
  {
    name: 'vocab_lookup_fast',
    description:
      'Tra nhanh từ vựng tiếng Anh (<200ms) gồm IPA, loại từ, nghĩa tiếng Việt, Word Family, Collocations và lưu vào kho/Sheet.',
    inputSchema: {
      type: 'object',
      properties: {
        word: { type: 'string', description: 'Từ hoặc cụm từ tiếng Anh cần tra.' },
        contextSentence: { type: 'string', description: 'Câu ngữ cảnh (tùy chọn).' },
        meaningVi: { type: 'string', description: 'Nghĩa tiếng Việt bổ sung (tùy chọn).' },
        topic: { type: 'string', description: 'Chủ đề trên Sheet (tùy chọn).' },
        difficulty: { type: 'string', description: 'Độ khó, ví dụ Trung bình (B2) (tùy chọn).' },
        note: { type: 'string', description: 'Ghi chú ngữ pháp hoặc họ từ (tùy chọn).' },
        save: { type: 'boolean', description: 'Có lưu vào kho local và đồng bộ Sheet hay không (mặc định true).' },
      },
      required: ['word'],
    },
  },
  {
    name: 'writing_evaluate_fast',
    description:
      'Kiểm tra nhanh lỗi ngữ pháp, chính tả, cách dùng từ mục tiêu trong câu tiếng Anh và gợi ý 3 câu nâng cấp.',
    inputSchema: {
      type: 'object',
      properties: {
        targetWord: { type: 'string', description: 'Từ mục tiêu đang luyện tập.' },
        userSentence: { type: 'string', description: 'Câu tiếng Anh cần chấm và sửa lỗi.' },
      },
      required: ['userSentence'],
    },
  },
  {
    name: 'reading_generate_passage',
    description:
      'Tạo bài tập Reading Cloze (đọc hiểu và điền từ vào chỗ trống) dựa trên các từ đang học trong Google Sheet.',
    inputSchema: {
      type: 'object',
      properties: {
        topic: { type: 'string', description: 'Lọc theo chủ đề trên Sheet (tùy chọn).' },
        syncFirst: { type: 'boolean', description: 'Đồng bộ lại từ Google Sheet trước khi tạo bài đọc (tùy chọn).' },
        spreadsheetId: { type: 'string', description: 'Google Spreadsheet ID (tùy chọn).' },
      },
    },
  },
  {
    name: 'google_oauth_url',
    description:
      'Tạo liên kết Google OAuth2 để người dùng cấp quyền ghi 2 chiều lên Google Spreadsheet.',
    inputSchema: {
      type: 'object',
      properties: {
        state: { type: 'string', description: 'Chuỗi state tùy chọn cho phiên OAuth.' },
      },
    },
  },
];

function writeMessage(payload) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

function sendResult(id, result) {
  writeMessage({ jsonrpc: '2.0', id, result });
}

function sendError(id, code, message, data) {
  const err = { code, message };
  if (data !== undefined) err.data = data;
  writeMessage({ jsonrpc: '2.0', id, error: err });
}

async function handleToolCall(name, args = {}) {
  const storePath = getDefaultStorePath();

  if (name === 'sheets_sync_vocab') {
    const sheetId = (args.spreadsheetId || DEFAULT_SPREADSHEET_ID).trim();
    const synced = await syncWithGoogleSheet(storePath, sheetId);
    return {
      totalWords: synced.words.length,
      summary: synced.summary,
      spreadsheetUrl: synced.spreadsheetUrl,
      words: synced.words.map((w) => ({
        word: w.word,
        ipa: w.ipa,
        partOfSpeech: w.partOfSpeech,
        meaningVi: w.meaningVi,
        topic: w.topic,
        status: w.status,
        difficulty: w.difficulty,
        note: w.note,
      })),
    };
  }

  if (name === 'vocab_lookup_fast') {
    const word = String(args.word || '').trim();
    if (!word) throw new Error('Thiếu tham số word.');

    const analyzed = await analyzeWordFast(word, args.contextSentence || '', {
      meaningVi: args.meaningVi || '',
      topic: args.topic || '',
      difficulty: args.difficulty || '',
      note: args.note || '',
    });

    let saved = null;
    let sheetSync = null;
    if (args.save !== false) {
      saved = upsertWord(analyzed, storePath);
      sheetSync = await appendOrUpdateSheetRow(saved.word, args.spreadsheetId || DEFAULT_SPREADSHEET_ID).catch(
        (err) => ({ syncedToSheet: false, error: err.message })
      );
    }

    return {
      wordData: saved ? saved.word : analyzed,
      isNew: saved ? saved.isNew : undefined,
      sheetSync,
    };
  }

  if (name === 'writing_evaluate_fast') {
    const userSentence = String(args.userSentence || '').trim();
    if (!userSentence) throw new Error('Thiếu tham số userSentence.');

    const targetWord = String(args.targetWord || '').trim();
    const store = loadStore(storePath);
    const wordInfo = targetWord
      ? store.words.find((w) => w.word.toLowerCase() === targetWord.toLowerCase()) || null
      : null;

    return evaluateSentenceFast(targetWord || undefined, userSentence, wordInfo);
  }

  if (name === 'reading_generate_passage') {
    const sheetId = (args.spreadsheetId || DEFAULT_SPREADSHEET_ID).trim();
    if (args.syncFirst) {
      await syncWithGoogleSheet(storePath, sheetId);
    }
    const store = loadStore(storePath);
    if (!store.words || store.words.length === 0) {
      await syncWithGoogleSheet(storePath, sheetId);
    }
    const latest = loadStore(storePath);
    return generateReadingExercise(latest.words, args.topic || '');
  }

  if (name === 'google_oauth_url') {
    return {
      authUrl: getGoogleAuthUrl(args.state || 'vocab-daily'),
      redirectUri: process.env.GOOGLE_REDIRECT_URI || 'https://antigravity.google/oauth-callback',
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    };
  }

  const err = new Error(`Không tìm thấy tool MCP: ${name}`);
  err.code = -32602;
  throw err;
}

async function dispatchMessage(msg) {
  if (!msg || typeof msg !== 'object') {
    return sendError(null, -32600, 'Invalid Request');
  }

  const { id, method, params } = msg;
  const hasId = id !== undefined && id !== null;

  if (method === 'initialize') {
    return sendResult(id, {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: { tools: {} },
      serverInfo: SERVER_INFO,
    });
  }

  if (method === 'notifications/initialized' || String(method || '').startsWith('notifications/')) {
    return;
  }

  if (method === 'ping') {
    if (hasId) sendResult(id, {});
    return;
  }

  if (method === 'tools/list') {
    return sendResult(id, { tools: TOOLS });
  }

  if (method === 'tools/call') {
    try {
      const toolName = params?.name;
      const toolArgs = params?.arguments || {};
      const output = await handleToolCall(toolName, toolArgs);
      return sendResult(id, {
        content: [{ type: 'text', text: JSON.stringify(output, null, 2) }],
        isError: false,
      });
    } catch (err) {
      if (err.code === -32602) {
        return sendError(id, -32602, err.message);
      }
      return sendResult(id, {
        content: [{ type: 'text', text: err.message || 'Tool execution error' }],
        isError: true,
      });
    }
  }

  if (hasId) {
    sendError(id, -32601, `Method not found: ${method}`);
  }
}

function startMcpServer() {
  const rl = readline.createInterface({
    input: process.stdin,
    crlfDelay: Infinity,
  });

  rl.on('line', (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let parsed;
    try {
      parsed = JSON.parse(trimmed);
    } catch (err) {
      sendError(null, -32700, `Parse error: ${err.message}`);
      return;
    }
    dispatchMessage(parsed).catch((err) => {
      if (parsed?.id !== undefined) {
        sendError(parsed.id, -32603, err.message || 'Internal error');
      }
    });
  });

  rl.on('close', () => {
    process.exit(0);
  });
}

if (require.main === module) {
  startMcpServer();
}

module.exports = {
  TOOLS,
  handleToolCall,
  dispatchMessage,
  startMcpServer,
};
