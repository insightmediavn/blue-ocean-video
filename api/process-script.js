export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { scriptContent } = req.body;
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = "openai/gpt-4o";

  if (!apiKey || !scriptContent || scriptContent.trim().length < 20) {
    return res.status(400).json({ error: "Missing API key or script content too short." });
  }

  const prompt = `
Dưới đây là một đoạn kịch bản video:

${scriptContent}

Trích xuất tối đa 15 từ khóa quan trọng nhất có liên quan đến nội dung. 
Chỉ trả về JSON như ví dụ sau, KHÔNG thêm bất kỳ chữ nào khác ngoài JSON:

{
  "keywords": ["từ khóa 1", "từ khóa 2", "từ khóa 3"]
}
⚠️ Không thêm tiêu đề, lời chào, cảm ơn hay bất cứ gì ngoài JSON.
`;

  try {
    const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "user", content: prompt }
        ],
        temperature: 0.3,
      }),
    });

    const raw = await aiRes.text();
    console.log("🔵 RAW TEXT FROM OPENROUTER:\n", raw);

    // Loại bỏ markdown block nếu có
    const match = raw.match(/```json\s*([\s\S]*?)\s*```/i) || raw.match(/\{[\s\S]*\}/);
    if (!match || match.length < 1) {
      return res.status(400).json({ error: "Could not extract JSON from AI response", raw });
    }

    let parsed;
    try {
      parsed = JSON.parse(match[1] || match[0]);
    } catch (err) {
      return res.status(400).json({ error: "Invalid JSON format from AI", raw });
    }

    if (!parsed.keywords || !Array.isArray(parsed.keywords)) {
      return res.status(400).json({ error: "Missing or invalid 'keywords' in response", parsed });
    }

    return res.status(200).json({ result: parsed });

  } catch (err) {
    return res.status(500).json({ error: "Internal server error", detail: err.message });
  }
}
