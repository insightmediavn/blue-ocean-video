export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { scriptContent } = req.body;
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL_ID || "openai/gpt-4o";

  if (!apiKey) {
    return res.status(401).json({ error: "Missing API key." });
  }

  if (!scriptContent || scriptContent.trim().length < 20) {
    return res.status(400).json({ error: "Script content is too short or missing." });
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
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3
      })
    });

    const raw = await response.text(); // lấy thô nội dung
    console.log("📡 Raw OpenRouter response:\n", raw); // in ra để debug

    let data;
    try {
      data = JSON.parse(raw);
    } catch (parseError) {
      return res.status(500).json({ error: "Không thể phân tích JSON từ AI.", debug: raw });
    }

    const content = data?.choices?.[0]?.message?.content?.trim();
    if (!content) {
      return res.status(400).json({ error: "AI returned an empty response.", debug: data });
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(400).json({ error: "AI response không có JSON hợp lệ.", debug: content });
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch (e) {
      return res.status(400).json({ error: "Không thể parse JSON từ nội dung AI.", rawContent: content });
    }

    if (!parsed.keywords || !Array.isArray(parsed.keywords)) {
      return res.status(400).json({ error: "JSON không chứa mảng 'keywords' hợp lệ.", rawParsed: parsed });
    }

    return res.status(200).json({ result: parsed });
  } catch (error) {
    return res.status(500).json({
      error: "Yêu cầu đến AI thất bại.",
      detail: error.message
    });
  }
}
