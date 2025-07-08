export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  const { scriptContent } = req.body;

  if (!scriptContent || scriptContent.trim().length === 0) {
    return res.status(400).json({ error: "No script content provided." });
  }

  const prompt = `
Dưới đây là một đoạn kịch bản video:

${scriptContent}

Trích xuất tối đa 15 từ khóa quan trọng nhất liên quan đến nội dung. 
Chỉ trả về JSON đúng định dạng, không thêm bất kỳ ký tự nào khác:

{
  "keywords": ["từ khóa 1", "từ khóa 2", "từ khóa 3"]
}
`;

  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL_ID || "openai/gpt-4o";

  if (!apiKey) {
    return res.status(500).json({ error: "Missing OPENROUTER_API_KEY" });
  }

  try {
    const apiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3
      })
    });

    const data = await apiRes.json();

    const raw = data?.choices?.[0]?.message?.content?.trim();

    if (!raw) {
      return res.status(400).json({ error: "AI returned an empty response." });
    }

    const jsonMatch = raw.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) {
      return res.status(400).json({ error: "AI response is not valid JSON." });
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch (e) {
      return res.status(400).json({ error: "Could not parse extracted JSON from AI." });
    }

    if (!parsed.keywords || !Array.isArray(parsed.keywords)) {
      return res.status(400).json({ error: "JSON does not contain valid 'keywords' array." });
    }

    return res.status(200).json({ result: parsed });
  } catch (err) {
    console.error("Error in API:", err);
    return res.status(500).json({ error: "AI API error", detail: err.message });
  }
}
