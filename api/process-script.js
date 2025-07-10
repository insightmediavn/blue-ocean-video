export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { scriptContent } = req.body;
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL_ID || "openai/gpt-4o";

  if (!apiKey || !apiKey.startsWith("sk-or-")) {
    return res.status(401).json({ error: "API Key missing or invalid." });
  }

  if (!scriptContent || scriptContent.trim().length < 20) {
    return res.status(400).json({ error: "Script content is too short or empty." });
  }

  try {
    const prompt = `Dưới đây là một đoạn kịch bản video:

${scriptContent}

Trích xuất tối đa 15 từ khóa quan trọng nhất có liên quan đến nội dung. 
Chỉ trả về JSON như ví dụ sau, KHÔNG thêm bất kỳ chữ nào khác ngoài JSON:

{
  "keywords": ["từ khóa 1", "từ khóa 2", "từ khóa 3"]
}
⚠️ KHÔNG được thêm tiêu đề, lời chào, hay markdown như \`\`\`json.`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "user", content: prompt }
        ],
        temperature: 0.3
      })
    });

    const data = await response.json();
    const raw = data?.choices?.[0]?.message?.content || "";

    // ✅ Tách JSON từ block markdown ```json ... ```
    const match = raw.match(/```json\s*([\s\S]*?)\s*```/) || raw.match(/\{[\s\S]*\}/);
    if (!match) {
      return res.status(400).json({ error: "Could not extract JSON from AI response.", raw });
    }

    let parsed;
    try {
      parsed = JSON.parse(match[1] || match[0]);
    } catch (e) {
      return res.status(400).json({ error: "JSON.parse failed", raw });
    }

    if (!parsed.keywords || !Array.isArray(parsed.keywords)) {
      return res.status(400).json({ error: "No valid 'keywords' array found", raw });
    }

    return res.status(200).json({ result: parsed });
  } catch (error) {
    return res.status(500).json({ error: "Internal server error", detail: error.message });
  }
}
