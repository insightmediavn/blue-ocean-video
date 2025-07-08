export default async function handler(req, res) {
  try {
    // 1. Chỉ cho phép phương thức POST
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed. Use POST." });
    }

    // 2. Kiểm tra script đầu vào
    const { scriptContent } = req.body;
    if (!scriptContent || scriptContent.trim().length === 0) {
      return res.status(400).json({ error: "No script content provided." });
    }

    // 3. Lấy API Key và Model từ môi trường
    const apiKey = process.env.OPENROUTER_API_KEY;
    const model = process.env.OPENROUTER_MODEL_ID || "openai/gpt-4o";

    // 4. Kiểm tra API Key
    if (!apiKey || !apiKey.startsWith("sk-or-")) {
      return res.status(500).json({ error: "Missing or invalid OPENROUTER_API_KEY." });
    }

    // 5. Tạo prompt rõ ràng
    const prompt = `Dưới đây là một đoạn kịch bản video:

${scriptContent}

Trích xuất tối đa 15 từ khóa quan trọng nhất liên quan đến nội dung. 
Chỉ trả về JSON như sau, KHÔNG thêm bất kỳ chữ nào khác ngoài JSON:

{
  "keywords": ["từ khóa 1", "từ khóa 2", "từ khóa 3"]
}
⚠️ KHÔNG thêm tiêu đề, lời chào hay mô tả.`

    // 6. Gửi yêu cầu đến OpenRouter
    const apiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
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

    // 7. Kiểm tra lỗi hệ thống
    if (!apiRes.ok) {
      const detail = await apiRes.text();
      return res.status(500).json({ error: "AI API error", detail });
    }

    // 8. Xử lý kết quả
    const result = await apiRes.json();
    const rawContent = result?.choices?.[0]?.message?.content?.trim();

    if (!rawContent) {
      return res.status(400).json({ error: "AI returned an empty response." });
    }

    // 9. Trích JSON từ đoạn trả về
    const jsonMatch = rawContent.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) {
      return res.status(400).json({ error: "AI response is not valid JSON." });
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch (err) {
      return res.status(400).json({ error: "Could not parse extracted JSON from AI." });
    }

    if (!parsed.keywords || !Array.isArray(parsed.keywords)) {
      return res.status(400).json({ error: "JSON does not contain valid 'keywords' array." });
    }

    // 10. Trả về kết quả thành công
    return res.status(200).json({ result: parsed });
  } catch (error) {
    console.error("Fatal Error:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
}
