// pages/api/process-script.ts

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST method is allowed." });
  }

  const { script } = req.body;
  if (!script || script.trim().length < 20) {
    return res.status(400).json({ error: "Script is missing or too short." });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL_ID || "openai/gpt-4o";

  if (!apiKey) {
    return res.status(500).json({ error: "Missing OpenRouter API Key." });
  }

  const prompt = `Dưới đây là một đoạn kịch bản video tiếng Việt dành cho người cao tuổi Mỹ:

${script}

1. Hãy phân chia đoạn kịch bản này thành từng cảnh ngắn, mỗi cảnh tương ứng với một dòng thoại rõ ràng.
2. Với mỗi cảnh:
  - Dịch sang tiếng Anh tự nhiên, dễ hiểu.
  - Trích xuất tối đa 3 từ khoá hình ảnh có thể minh hoạ (ảnh hoặc video), viết bằng tiếng Anh.

Trả kết quả dưới dạng JSON, không thêm chữ nào ngoài JSON:

[
  {
    "vi": "Câu thoại tiếng Việt",
    "en": "English translation",
    "keywords": ["image keyword 1", "keyword 2"]
  },
  ...
]`;

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "user", content: prompt }
        ],
        temperature: 0.4
      })
    });

    const raw = await response.text();
    console.log("🔎 RAW AI RESPONSE:", raw);

    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return res.status(400).json({ error: "AI response is not an array." });
      }
      return res.status(200).json({ result: parsed });
    } catch (err) {
      return res.status(400).json({ error: "Could not parse AI response as JSON.", raw });
    }
  } catch (error) {
    return res.status(500).json({ error: "AI request failed.", detail: error.message });
  }
}
