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
⚠️ KHÔNG được thêm tiêu đề, lời chào, hay markdown như \`\`\`json.`

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.3
      })
    });

    const data = await response.json();

    const rawContent = data?.choices?.[0]?.message?.content?.trim() || "";

    // 🔍 Xử lý nếu AI trả về JSON nằm trong ```json ... ```
    const jsonMatch = rawContent.match(/```json\s*([\s\S]*?)\s*```/i) || rawContent.match(/\{[\s\S]*\}/);

    if (!jsonMatch || jsonMatch.length === 0) {
      return res.status(400).json({ error: "AI response is not valid JSON.", raw: rawContent });
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]); // xử lý cả khi không có markdown
    } catch (e) {
      return res.status(400).json({ error: "Could not parse JSON.", raw: rawContent });
    }

    if (!parsed.keywords || !Array.isArray(parsed.keywords)) {
      return res.status(400).json({ error: "Missing or invalid 'keywords' in response." });
    }

    return res.status(200).json({ result: parsed });
  } catch (error) {
    return res.status(500).json({
      error: "Internal server error.",
      detail: error.message
    });
  }
}
