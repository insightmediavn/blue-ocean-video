export default async function handler(request, response) {
  try {
    if (request.method !== "POST") {
      return response.status(405).json({ error: "Method not allowed. Use POST." });
    }

    const { scriptContent } = request.body;

    if (!scriptContent || scriptContent.trim().length === 0) {
      return response.status(400).json({ error: "No script content provided." });
    }

    const prompt = `Dưới đây là một đoạn kịch bản video:

${scriptContent}

Trích xuất tối đa 15 từ khóa quan trọng nhất có liên quan đến nội dung.
Chỉ trả về JSON như ví dụ sau, KHÔNG thêm bất kỳ chữ nào khác ngoài JSON:

{
  "keywords": ["từ khóa 1", "từ khóa 2", "từ khóa 3"]
}`;

    const apiKey = process.env.OPENROUTER_API_KEY;
    const model = process.env.OPENROUTER_MODEL_ID || "openai/gpt-4o";

    if (!apiKey) {
      return response.status(500).json({ error: "Missing OPENROUTER_API_KEY" });
    }

    const apiResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3
      })
    });

    if (!apiResponse.ok) {
      const errorDetail = await apiResponse.text();
      return response.status(500).json({ error: "AI API error", detail: errorDetail });
    }

    const data = await apiResponse.json();
    const content = data.choices?.[0]?.message?.content?.trim();

    if (!content) {
      return response.status(400).json({ error: "AI returned an empty response." });
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return response.status(400).json({ error: "AI response does not contain valid JSON." });
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch (err) {
      return response.status(400).json({ error: "Could not parse extracted JSON from AI." });
    }

    if (!parsed.keywords || !Array.isArray(parsed.keywords)) {
      return response.status(400).json({ error: "JSON does not contain valid 'keywords' array." });
    }

    return response.status(200).json({ result: parsed });
  } catch (err) {
    console.error("Unexpected error:", err);
    return response.status(500).json({ error: "Internal server error." });
  }
}
