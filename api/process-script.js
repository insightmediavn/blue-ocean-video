export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  const { scriptContent } = req.body;

  if (!scriptContent || typeof scriptContent !== "string" || scriptContent.trim().length === 0) {
    return res.status(400).json({ error: "No script content provided." });
  }

  const prompt = `Dưới đây là một đoạn kịch bản video:

${scriptContent}

Trích xuất tối đa 15 từ khóa quan trọng nhất có liên quan đến nội dung. 
Chỉ trả về JSON như ví dụ sau, KHÔNG thêm bất kỳ chữ nào khác ngoài JSON:

{
  "keywords": ["từ khóa 1", "từ khóa 2", "từ khóa 3"]
}
⚠️ Không thêm tiêu đề, lời chào, cảm ơn hay bất cứ gì ngoài JSON.`;

  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL_ID || "openai/gpt-3.5-turbo";

  if (!apiKey) {
    return res.status(500).json({ error: "Missing OPENROUTER_API_KEY" });
  }

  try {
    const responseAI = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3
      })
    });

    const data = await responseAI.json();

    if (!data.choices || !data.choices[0]?.message?.content) {
      return res.status(400).json({ error: "AI returned an empty response." });
    }

    const raw = data.choices[0].message.content.trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return res.status(400).json({ error: "AI response is not valid JSON." });
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch (err) {
      return res.status(400).json({ error: "Could not parse JSON." });
    }

    if (!parsed.keywords || !Array.isArray(parsed.keywords)) {
      return res.status(400).json({ error: "JSON does not contain valid 'keywords' array." });
    }

    return res.status(200).json({ result: parsed });
  } catch (error) {
    console.error("Error calling AI:", error);
    return res.status(500).json({ error: "Failed to process AI request." });
  }
}
