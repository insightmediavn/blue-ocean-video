export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST requests allowed." });
  }

  const { scriptContent } = req.body;

  if (!scriptContent || scriptContent.trim().length < 10) {
    return res.status(400).json({ error: "scriptContent is too short or missing." });
  }

  const apiKey = process.env.OPENROUTER_API_KEY || "sk-or-v1-your-real-key";
  const model = process.env.OPENROUTER_MODEL_ID || "openai/gpt-4o";

  const prompt = `Dưới đây là một đoạn kịch bản video:

${scriptContent}

Trích xuất tối đa 15 từ khóa quan trọng nhất có liên quan đến nội dung. 
Chỉ trả về JSON như sau, KHÔNG thêm bất kỳ chữ nào khác:

{
  "keywords": ["từ khóa 1", "từ khóa 2", "từ khóa 3"]
}`;

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2
      })
    });

    const rawText = await response.text();
    console.log("🔵 RAW TEXT FROM OPENROUTER:\n", rawText);

    let json;
    try {
      json = JSON.parse(rawText);
    } catch (e) {
      return res.status(400).json({ error: "Failed to parse AI response as JSON.", raw: rawText });
    }

    const content = json?.choices?.[0]?.message?.content?.trim();

    if (!content) {
      return res.status(400).json({ error: "AI returned an empty response.", raw: json });
    }

    const match = content.match(/\{[\s\S]*\}/);
    if (!match) {
      return res.status(400).json({ error: "No JSON object found in AI response.", content });
    }

    let result;
    try {
      result = JSON.parse(match[0]);
    } catch (e) {
      return res.status(400).json({ error: "Failed to parse extracted JSON.", json: match[0] });
    }

    if (!Array.isArray(result.keywords)) {
      return res.status(400).json({ error: "Missing 'keywords' array in response.", result });
    }

    return res.status(200).json({ result });

  } catch (err) {
    return res.status(500).json({ error: "Request to OpenRouter failed.", detail: err.message });
  }
}
