/**
 * Elite Language Center — Gemini AI Service
 * Ported from syquandev/demo, adapted for vanilla JS
 * Uses ES Module import via CDN
 */

let genAI = null;
let model = null;

/**
 * Initialize Gemini with API Key
 */
function initGemini(apiKey) {
    // Dynamic import for ES Module
    import('https://esm.run/@google/generative-ai').then(({ GoogleGenerativeAI }) => {
        genAI = new GoogleGenerativeAI(apiKey);
        model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        console.log('✅ Gemini AI initialized');
    }).catch(err => {
        console.error('❌ Failed to init Gemini:', err);
    });
}

function isGeminiReady() {
    return model !== null;
}

/**
 * Extract text from single image using Gemini Vision (OCR)
 */
async function extractTextFromImage(base64Data, mimeType) {
    if (!model) throw new Error('Gemini chưa được khởi tạo. Vui lòng nhập API Key.');

    const prompt = `Bạn là AI chuyên OCR (nhận dạng ký tự quang học). Hãy đọc và trích xuất TOÀN BỘ văn bản có trong hình ảnh này.

**Yêu cầu:**
- Trích xuất chính xác mọi chữ, số, ký hiệu trong ảnh
- Giữ nguyên cấu trúc, thứ tự dòng, đoạn văn
- Nếu có bảng, giữ nguyên dạng bảng
- Nếu có công thức toán, viết dưới dạng text
- Chỉ trả về nội dung text đã trích xuất, KHÔNG thêm giải thích hay nhận xét
- Nếu không đọc được ký tự nào, ghi "[không rõ]"`;

    const imagePart = {
        inlineData: { data: base64Data, mimeType: mimeType }
    };

    const result = await model.generateContent([prompt, imagePart]);
    return result.response.text();
}

/**
 * Extract text from multiple images using Gemini Vision (OCR)
 */
async function extractTextFromImages(images) {
    if (!model) throw new Error('Gemini chưa được khởi tạo. Vui lòng nhập API Key.');

    const prompt = `Bạn là AI chuyên OCR (nhận dạng ký tự quang học). Hãy đọc và trích xuất TOÀN BỘ văn bản có trong tất cả các hình ảnh được cung cấp.

**Yêu cầu:**
- Trích xuất chính xác mọi chữ, số, ký hiệu trong từng ảnh
- Giữ nguyên cấu trúc, thứ tự dòng, đoạn văn
- Phân tách nội dung từng ảnh bằng dấu "---" nếu có nhiều ảnh
- Nếu có bảng, giữ nguyên dạng bảng
- Nếu có công thức toán, viết dưới dạng text
- Chỉ trả về nội dung text đã trích xuất, KHÔNG thêm giải thích hay nhận xét`;

    const imageParts = images.map(img => ({
        inlineData: { data: img.base64Data, mimeType: img.mimeType }
    }));

    const result = await model.generateContent([prompt, ...imageParts]);
    return result.response.text();
}

/**
 * Generate exercises from content using AI
 */
async function generateExercises(content, difficulty = 'Trung bình') {
    if (!model) throw new Error('Gemini chưa được khởi tạo. Vui lòng nhập API Key.');

    const prompt = `Bạn là AI giáo dục chuyên nghiệp. Phân tích nội dung bên dưới và tạo bài tập.

**⚠️ QUY TẮC QUAN TRỌNG NHẤT — PHẢI TẠO ĐỦ 100% SỐ CÂU:**
1. BƯỚC 1: Đếm CHÍNH XÁC tổng số câu hỏi/bài tập/mục trong nội dung (mỗi dòng đánh số, mỗi item riêng biệt = 1 câu)
2. BƯỚC 2: Tạo ĐÚNG TỪNG CÂU MỘT, không bỏ sót, không gộp, không tóm tắt
3. Nếu nội dung có 22 câu → phải tạo 22 bài tập. Có 6 câu → tạo 6 bài tập. Có 30 câu → tạo 30 bài tập.
4. TUYỆT ĐỐI KHÔNG được bỏ sót bất kỳ câu nào. Đây là yêu cầu bắt buộc.
5. Nếu nội dung có nhiều phần/bài (ví dụ: Exercise 1, Exercise 2...), phải tạo bài tập cho TẤT CẢ các phần.

**Các loại bài tập (chọn type phù hợp cho TỪNG câu):**
- "write_sentence" — Viết câu từ gợi ý
- "fill_blank" — Điền vào chỗ trống
- "rewrite" — Viết lại câu
- "multiple_choice" — Trắc nghiệm (cần options + correctIndex)
- "matching" — Nối (cần columnA + columnB + correctPairs)
- "ordering" — Sắp xếp từ/câu
- "short_answer" — Trả lời ngắn
- "translation" — Dịch câu

**Mức độ khó:** ${difficulty}

**Format JSON (KHÔNG thêm text ngoài JSON, chỉ trả về mảng JSON):**
[
  {
    "type": "write_sentence",
    "instruction": "Viết câu hoàn chỉnh sử dụng các từ gợi ý sau",
    "question": "every day / get up / at half past seven",
    "sampleAnswer": "I get up at half past seven every day.",
    "hints": "Sử dụng thì hiện tại đơn"
  },
  {
    "type": "fill_blank",
    "instruction": "Điền từ thích hợp vào chỗ trống",
    "question": "She ___ (go) to school every morning.",
    "sampleAnswer": "goes",
    "hints": ""
  },
  {
    "type": "multiple_choice",
    "instruction": "Chọn đáp án đúng",
    "question": "Câu hỏi?",
    "options": ["Đáp án A", "Đáp án B"],
    "correctIndex": 0,
    "explanation": "Giải thích"
  }
]

**Mỗi câu BẮT BUỘC có:** type, instruction, question, sampleAnswer
**Riêng multiple_choice thêm:** options (mảng 2 đến 4 đáp án), correctIndex (chỉ số đáp án đúng, bắt đầu từ 0), explanation
**Riêng matching thêm:** columnA, columnB, correctPairs

**Nội dung bài học (TẠO BÀI TẬP CHO TỪNG CÂU BÊN DƯỚI, KHÔNG BỎ SÓT):**
${content}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
        throw new Error('Không thể parse kết quả AI. Vui lòng thử lại.');
    }

    return JSON.parse(jsonMatch[0]);
}

/**
 * AI grades the student's exercise submission
 */
async function gradeExercise(questions, answers) {
    if (!model) throw new Error('Gemini chưa được khởi tạo. Vui lòng nhập API Key.');

    const qaList = questions.map((q, i) => {
        const answer = answers[i] || '(Không trả lời)';

        if (q.type === 'multiple_choice') {
            const selectedOption = q.options?.[answer] || answer;
            const correctOption = q.options?.[q.correctIndex];
            return `Câu ${i + 1} (Trắc nghiệm): ${q.question}
- Đáp án đúng: ${correctOption}
- Học viên chọn: ${selectedOption}
- Kết quả: ${answer === q.correctIndex ? 'ĐÚNG' : 'SAI'}`;
        }

        if (q.type === 'matching') {
            return `Câu ${i + 1} (Nối): ${q.question}
- Cột A: ${q.columnA?.join(', ')}
- Cột B: ${q.columnB?.join(', ')}
- Đáp án đúng: ${JSON.stringify(q.correctPairs)}
- Học viên chọn: ${answer}`;
        }

        const typeLabels = {
            write_sentence: 'Viết câu',
            fill_blank: 'Điền từ',
            rewrite: 'Viết lại câu',
            ordering: 'Sắp xếp',
            short_answer: 'Trả lời ngắn',
            translation: 'Dịch',
        };

        return `Câu ${i + 1} (${typeLabels[q.type] || q.type}): ${q.instruction || ''}
- Đề bài: ${q.question}
- Đáp án mẫu: ${q.sampleAnswer || ''}
- Gợi ý: ${q.hints || ''}
- Bài làm học viên: ${answer}`;
    }).join('\n\n');

    const prompt = `Bạn là giáo viên AI chấm bài. Hãy chấm điểm và nhận xét bài làm của học viên.

**Bài làm:**
${qaList}

**Yêu cầu trả về JSON (KHÔNG thêm text ngoài JSON):**
{
  "totalScore": 8.5,
  "maxScore": 10,
  "overallComment": "Nhận xét tổng quan về bài làm",
  "strengths": ["Điểm mạnh 1", "Điểm mạnh 2"],
  "weaknesses": ["Điểm yếu 1"],
  "suggestions": ["Gợi ý cải thiện 1", "Gợi ý cải thiện 2"],
  "questionFeedback": [
    {
      "questionIndex": 0,
      "score": 1,
      "maxScore": 1,
      "feedback": "Nhận xét cho câu này",
      "correctedAnswer": "Đáp án đúng nếu học viên làm sai (optional)"
    }
  ]
}

- Chấm điểm công bằng, chi tiết cho từng loại bài tập
- Với bài viết câu/dịch/viết lại: chấm cả ngữ pháp, từ vựng, ý nghĩa
- Với bài điền từ: chấm chính xác từ điền
- Nhận xét khuyến khích, mang tính xây dựng
- Nếu bài làm gần đúng nhưng có lỗi nhỏ, vẫn cho điểm một phần
- Cung cấp correctedAnswer khi học viên làm sai
- Tổng điểm trên thang 10`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        throw new Error('Không thể parse kết quả chấm điểm. Vui lòng thử lại.');
    }

    return JSON.parse(jsonMatch[0]);
}

/**
 * Local grading fallback (MCQ only)
 */
function gradeLocally(questions, answers) {
    let correct = 0;
    let mcCount = 0;
    const feedback = [];

    questions.forEach((q, i) => {
        if (q.type === 'multiple_choice') {
            mcCount++;
            const isCorrect = answers[i] === q.correctIndex;
            if (isCorrect) correct++;
            feedback.push({
                questionIndex: i,
                score: isCorrect ? 1 : 0,
                maxScore: 1,
                feedback: isCorrect
                    ? 'Chính xác! ' + (q.explanation || '')
                    : `Sai. Đáp án đúng: ${q.options[q.correctIndex]}. ${q.explanation || ''}`,
            });
        } else {
            feedback.push({
                questionIndex: i,
                score: 0,
                maxScore: 1,
                feedback: 'Cần AI chấm điểm cho loại bài này. Vui lòng nhập API Key.',
                correctedAnswer: q.sampleAnswer || '',
            });
        }
    });

    const totalScore = mcCount > 0
        ? Math.round((correct / questions.length) * 10 * 10) / 10
        : 0;

    return {
        totalScore,
        maxScore: 10,
        overallComment: mcCount > 0
            ? `Bạn trả lời đúng ${correct}/${mcCount} câu trắc nghiệm.`
            : 'Bài tập này cần AI chấm điểm.',
        strengths: correct > mcCount / 2 ? ['Nắm tốt kiến thức cơ bản'] : [],
        weaknesses: correct <= mcCount / 2 && mcCount > 0 ? ['Cần ôn lại kiến thức'] : [],
        suggestions: ['Nhập API Key để AI chấm chi tiết tất cả các loại bài'],
        questionFeedback: feedback,
    };
}
