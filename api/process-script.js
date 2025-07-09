export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST method is allowed." });
  }

  const { scriptContent } = req.body;

  if (!scriptContent || scriptContent.trim().length < 20) {
    return res.status(400).json({ error: "Script content is missing or too short." });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL_ID || "openai/gpt-4o";

  if (!apiKey || !apiKey.startsWith("sk-or-v1-")) {
    return res.status(401).json({ error: "Missing or invalid OpenRouter API key." });
  }

  try {
    const prompt = `Dưới đây là một đoạn kịch bản video:

${scriptContent}

Hãy trích xuất tối đa 15 từ khóa quan trọng nhất có liên quan đến nội dung. 
Chỉ trả về JSON như sau, KHÔNG thêm bất kỳ chữ nào khác ngoài JSON:

{
  "keywords": ["từ khóa 1", "từ khóa 2", "từ khóa 3"]
}`;

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
        temperature: 0.2
      })
    });

    const raw = await response.text();

    // ✅ In log để debug trực tiếp
    console.log("📡 OpenRouter raw response:\n", raw);

    let json;
    try {
      json = JSON.parse(raw);
    } catch (err) {
      return res.status(400).json({ error: "AI response is not valid JSON.", detail: raw });
    }

    const aiContent = json?.choices?.[0]?.message?.content?.trim();

    if (!aiContent) {
      return res.status(400).json({
        error: "AI returned an empty or invalid content.",
        raw: json
      });
    }

    const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch || jsonMatch.length === 0) {
      return res.status(400).json({ error: "Response does not contain valid JSON format.", content: aiContent });
    }

    let extracted;
    try {
      extracted = JSON.parse(jsonMatch[0]);
    } catch (e) {
      return res.status(400).json({ error: "Could not parse extracted JSON from AI.", json: jsonMatch[0] });
    }

    if (!extracted.keywords || !Array.isArray(extracted.keywords)) {
      return res.status(400).json({ error: "Extracted JSON does not contain a valid 'keywords' array." });
    }

    return res.status(200).json({ result: extracted });

  } catch (err) {
    console.error("🔥 Error in handler:", err);
    return res.status(500).json({ error: "Server error", detail: err.message });
  }
}
