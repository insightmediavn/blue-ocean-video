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

  if (!scriptContent || scriptContent.trim().length < 10) {
    return res.status(400).json({ error: "Script content is too short or empty." });
  }

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "user",
            content: `Dưới đây là một đoạn kịch bản video:\n\n${scriptContent}\n\nTrích xuất tối đa 15 từ khóa quan trọng nhất có liên quan đến nội dung. Chỉ trả về JSON như ví dụ sau, KHÔNG thêm bất kỳ chữ nào khác ngoài JSON:\n\n{\n  "keywords": ["từ khóa 1", "từ khóa 2", "từ khóa 3"]\n}`
          }
        ],
        temperature: 0.3,
      }),
    });

    const rawText = await response.text();
    console.log("🔵 RAW TEXT FROM OPENROUTER:\n", rawText);

    // Tách phần code block nếu có
    const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch || !jsonMatch[1]) {
      return res.status(400).json({ error: "AI returned an empty or unparsable response." });
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonMatch[1]);
    } catch (e) {
      return res.status(400).json({ error: "Failed to parse JSON from AI response.", raw: jsonMatch[1] });
    }

    if (!parsed.keywords || !Array.isArray(parsed.keywords)) {
      return res.status(400).json({ error: "Parsed result does not contain 'keywords' array." });
    }

    return res.status(200).json({ result: parsed });
  } catch (error) {
    return res.status(500).json({ error: "Server error during AI call.", detail: error.message });
  }
}
