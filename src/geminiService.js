const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash'];

function extractJsonText(rawText) {
  if (!rawText) throw new Error('Gemini returned empty response');
  let cleaned = rawText.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  }
  return JSON.parse(cleaned);
}

async function callGeminiJSON(prompt, apiKey, temperature = 0.4) {
  const key = (apiKey || process.env.GEMINI_API_KEY || '').trim();
  if (!key) {
    throw new Error('Thiếu GEMINI_API_KEY. Vui lòng nhập API key trong phần Cài đặt hoặc file .env.');
  }

  let lastError = null;
  for (const model of GEMINI_MODELS) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature,
            responseMimeType: 'application/json',
          },
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = payload?.error?.message || `HTTP ${response.status}`;
        lastError = new Error(`[${model}] ${message}`);
        if (response.status === 404 || response.status === 400 || response.status === 429 || response.status >= 500) {
          continue;
        }
        throw lastError;
      }

      const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
      return extractJsonText(text);
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('Không thể kết nối tới Gemini API.');
}

/**
 * Analyze a new English word or phrase: IPA, meaning, full Word Family, collocations, examples, writing prompt.
 */
async function analyzeWord(word, contextSentence = '', apiKey) {
  const cleanWord = String(word || '').trim();
  if (!cleanWord) throw new Error('Từ vựng không được để trống.');

  const contextBlock = contextSentence
    ? `Ngữ cảnh người học gặp từ này: "${contextSentence}".`
    : 'Không có ngữ cảnh kèm theo.';

  const prompt = `Bạn là giáo viên tiếng Anh chuyên sâu về từ vựng ứng dụng và ngữ pháp thực chiến cho người Việt.
Hãy phân tích từ/cụm từ tiếng Anh: "${cleanWord}".
${contextBlock}

Trả về duy nhất 1 JSON object hợp lệ (không markdown, không giải thích ngoài JSON) theo đúng schema sau:
{
  "word": "${cleanWord}",
  "ipa": "/phiên âm IPA chuẩn/",
  "partOfSpeech": "noun | verb | adjective | adverb | phrase",
  "register": "Formal | Informal | Academic | Everyday | Business",
  "meaningVi": "Nghĩa tiếng Việt ngắn gọn, rõ ràng, sát ngữ cảnh",
  "meaningEn": "Concise English definition",
  "wordFamily": {
    "nouns": [{ "word": "danh từ liên quan", "meaningVi": "nghĩa tiếng Việt", "example": "1 câu ví dụ ngắn bằng tiếng Anh" }],
    "verbs": [{ "word": "động từ liên quan", "meaningVi": "nghĩa tiếng Việt", "example": "1 câu ví dụ ngắn bằng tiếng Anh" }],
    "adjectives": [{ "word": "tính từ liên quan", "meaningVi": "nghĩa tiếng Việt", "example": "1 câu ví dụ ngắn bằng tiếng Anh" }],
    "adverbs": [{ "word": "trạng từ liên quan", "meaningVi": "nghĩa tiếng Việt", "example": "1 câu ví dụ ngắn bằng tiếng Anh" }],
    "synonyms": ["từ đồng nghĩa 1", "từ đồng nghĩa 2", "từ đồng nghĩa 3"],
    "antonyms": ["từ trái nghĩa 1", "từ trái nghĩa 2"]
  },
  "collocations": [
    { "phrase": "cụm từ đi kèm hay gặp 1", "meaningVi": "nghĩa cụm từ", "example": "câu ví dụ tự nhiên" },
    { "phrase": "cụm từ đi kèm hay gặp 2", "meaningVi": "nghĩa cụm từ", "example": "câu ví dụ tự nhiên" },
    { "phrase": "cụm từ đi kèm hay gặp 3", "meaningVi": "nghĩa cụm từ", "example": "câu ví dụ tự nhiên" },
    { "phrase": "cụm từ đi kèm hay gặp 4", "meaningVi": "nghĩa cụm từ", "example": "câu ví dụ tự nhiên" }
  ],
  "examples": [
    "Câu ví dụ thực tế 1 dùng từ mục tiêu.",
    "Câu ví dụ thực tế 2 dùng từ mục tiêu trong ngữ cảnh khác."
  ],
  "writingPrompt": "1 gợi ý tình huống thực tế bằng tiếng Việt để người học tự đặt 1 câu ngay với từ này"
}

Lưu ý: Nếu loại từ nào không tồn tại trong họ từ thực tế (ví dụ không có trạng từ), trả mảng rỗng [] cho loại đó, không tự bịa từ không tồn tại.`;

  return callGeminiJSON(prompt, apiKey, 0.3);
}

/**
 * Evaluate a user's written sentence with detailed grammar, structure, word-form feedback, and 3 upgrades.
 */
async function evaluateSentence(targetWord, userSentence, wordInfo = null, apiKey) {
  const cleanTarget = String(targetWord || '').trim();
  const cleanSentence = String(userSentence || '').trim();
  if (!cleanSentence) throw new Error('Vui lòng nhập câu tiếng Anh để chấm điểm.');

  const familyContext = wordInfo?.wordFamily
    ? `Họ từ tham khảo của "${cleanTarget}": ${JSON.stringify(wordInfo.wordFamily)}`
    : '';

  const prompt = `Bạn là chuyên gia sửa bài viết tiếng Anh cho người Việt.
Từ vựng mục tiêu: "${cleanTarget || '(người dùng tự do viết câu)'}"
${familyContext}
Câu của người học: "${cleanSentence}"

Hãy đánh giá chi tiết ngữ pháp, cấu trúc câu, cách dùng từ (word choice), cách chia dạng từ (word form), giới từ đi kèm (collocation) và mức độ tự nhiên.
Trả về duy nhất 1 JSON object hợp lệ theo đúng schema sau:
{
  "score": 85,
  "isCorrectUsage": true,
  "correctedSentence": "Câu đã sửa chuẩn ngữ pháp, giữ nguyên ý định diễn đạt của người viết",
  "grammarErrors": [
    {
      "original": "đoạn viết sai hoặc gượng",
      "correction": "đoạn đã sửa đúng",
      "rule": "Tên quy tắc ngữ pháp/cấu trúc (ví dụ: Subject-Verb Agreement, Preposition Collocation, Word Form)",
      "explanationVi": "Giải thích ngắn gọn, dễ hiểu bằng tiếng Việt tại sao sai và cách nhớ"
    }
  ],
  "wordFormFeedback": "Nhận xét cụ thể về việc người học đã dùng đúng dạng từ (noun/verb/adj/adv) và cụm từ đi kèm hay chưa, gợi ý cách biến đổi sang dạng từ khác trong họ từ để câu hay hơn.",
  "upgradedVersions": {
    "natural": "Cách diễn đạt tự nhiên như người bản xứ giao tiếp hằng ngày",
    "academic": "Cách diễn đạt trang trọng, chuẩn IELTS/công việc chuyên nghiệp",
    "collocationRich": "Câu nâng cấp sử dụng collocation đắt giá gắn với từ mục tiêu"
  },
  "encouragementVi": "1 câu nhận xét trực diện, chỉ ra điểm làm tốt và 1 điểm cần ưu tiên chú ý lần sau."
}

Lưu ý: Nếu câu không có lỗi ngữ pháp nào, đặt "grammarErrors": [] và tập trung phân tích cách nâng cấp diễn đạt tự nhiên hơn. Score phải là số nguyên từ 0 đến 100.`;

  return callGeminiJSON(prompt, apiKey, 0.3);
}

/**
 * Generate a multi-mode practice quiz batch from the user's vocabulary list.
 * quizType: 'mixed' | 'word_form' | 'error_spot' | 'multiple_choice' | 'sentence_transform'
 */
async function generateQuizBatch(wordsList = [], quizType = 'mixed', apiKey, count = 5) {
  if (!Array.isArray(wordsList) || wordsList.length === 0) {
    throw new Error('Kho từ vựng đang trống. Hãy thêm ít nhất 1 từ trước khi tạo bài tập.');
  }

  const compactWords = wordsList.slice(0, 12).map((w) => ({
    word: w.word,
    partOfSpeech: w.partOfSpeech,
    meaningVi: w.meaningVi,
    wordFamily: {
      nouns: (w.wordFamily?.nouns || []).map((x) => x.word),
      verbs: (w.wordFamily?.verbs || []).map((x) => x.word),
      adjectives: (w.wordFamily?.adjectives || []).map((x) => x.word),
      adverbs: (w.wordFamily?.adverbs || []).map((x) => x.word),
    },
    collocations: (w.collocations || []).map((c) => c.phrase),
  }));

  const modeInstruction =
    quizType === 'mixed'
      ? `Trộn đều các dạng bài: "word_form" (chia đúng dạng noun/verb/adj/adv trong ngữ cảnh), "error_spot" (tìm phần gạch chân/cụm sai ngữ pháp hoặc collocation trong câu), "multiple_choice" (chọn từ/collocation đúng theo ngữ cảnh), và "sentence_transform" (viết lại hoặc dịch câu ngắn sang tiếng Anh có sử dụng từ mục tiêu hoặc họ từ của nó).`
      : `Chỉ tạo dạng bài "${quizType}".`;

  const prompt = `Bạn là người thiết kế bài tập ôn tập từ vựng tiếng Anh theo phương pháp ghi nhớ chủ động (Active Recall).
Danh sách từ vựng của người học:
${JSON.stringify(compactWords)}

Yêu cầu: Tạo đúng ${Math.min(count, Math.max(3, compactWords.length * 2))} câu hỏi ôn tập chất lượng cao.
${modeInstruction}

Trả về duy nhất 1 JSON object hợp lệ theo schema sau:
{
  "questions": [
    {
      "id": "q1",
      "type": "word_form | error_spot | multiple_choice | sentence_transform",
      "targetWord": "từ gốc trong danh sách",
      "question": "Nội dung câu hỏi (nếu điền từ dùng ___, nếu error_spot đánh dấu 4 cụm [A] ... [B] ... [C] ... [D] ... trong câu, nếu sentence_transform yêu cầu viết lại câu hoặc dịch câu Việt -> Anh)",
      "hint": "Gợi ý ngắn (ví dụ: cần Adjective, hoặc gợi ý cấu trúc)",
      "options": ["Lựa chọn A", "Lựa chọn B", "Lựa chọn C", "Lựa chọn D"],
      "correctAnswer": "Chuỗi khớp chính xác 100% với 1 phần tử trong options (hoặc câu đáp án mẫu nếu là sentence_transform)",
      "explanationVi": "Giải thích rõ ràng bằng tiếng Việt về ngữ pháp, họ từ hoặc collocation"
    }
  ]
}

Quy tắc bắt buộc:
- Với type "word_form", "error_spot", "multiple_choice": mảng "options" PHẢI có đúng 4 phần tử rõ ràng, không trùng lặp, và "correctAnswer" PHẢI khớp chính xác từng ký tự với một trong 4 phần tử trong "options".
- Với type "sentence_transform": "options" là mảng rỗng [], "correctAnswer" là 1 câu đáp án mẫu chuẩn xác.`;

  return callGeminiJSON(prompt, apiKey, 0.5);
}

module.exports = {
  callGeminiJSON,
  analyzeWord,
  evaluateSentence,
  generateQuizBatch,
};
