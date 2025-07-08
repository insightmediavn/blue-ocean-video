export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed. Use POST." });
  }

  const { scriptContent } = req.body;

  if (!scriptContent || scriptContent.trim() === "") {
    return res.status(400).json({ error: "Missing scriptContent." });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  const modelId = process.env.OPENROUTER_MODEL_ID || "openai/gpt-4o";

  if (!apiKey) {
    return res.status(500).json({ error: "Missing OPENROUTER_API_KEY" });
  }

  const prompt = `Dưới đây là một đoạn kịch bản video:\n\n${scriptContent}\n\nHãy trích xuất tối đa 15 từ khóa quan trọng nhất liên quan đến nội dung. Chỉ trả về JSON đúng như sau:\n\n{\n  "keywords": ["từ khóa 1", "từ khóa 2", "từ khóa 3"]\n}\nKhông thêm gì khác.`;

  try {
    const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3
      })
    });

    const data = await aiRes.json();

    console.log("⚠️ Full API Response:", JSON.stringify(data, null, 2)); // <-- dòng này quan trọng để debug

    if (!data.choices || !data.choices[0]?.message?.content) {
      return res.status(400).json({
        error: "AI returned an empty response.",
        fullResponse: data // trả về cho bạn xem luôn
      });
    }

    const raw = data.choices[0].message.content.trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return res.status(400).json({
        error: "AI response is not valid JSON.",
        raw
      });
    }

    let keywords;
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      keywords = parsed.keywords;
    } catch (e) {
      return res.status(400).json({ error: "Failed to parse JSON from AI response." });
    }

    if (!keywords || !Array.isArray(keywords)) {
      return res.status(400).json({ error: "Parsed result missing 'keywords' array." });
    }

    return res.status(200).json({ keywords });

  } catch (error) {
    console.error("❌ Error during AI processing:", error);
    return res.status(500).json({ error: "Internal server error.", detail: error.message });
  }
}
