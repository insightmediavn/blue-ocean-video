// pages/api/process-script.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  const modelId = process.env.OPENROUTER_MODEL_ID || "openai/gpt-4o";

  if (!apiKey) {
    return res.status(500).json({ error: "Missing API key" });
  }

  const { scriptContent } = req.body;

  if (!scriptContent || scriptContent.trim().length < 5) {
    return res.status(400).json({ error: "Missing or invalid script content" });
  }

  try {
    const completion = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: modelId,
        messages: [
          {
            role: "system",
            content: "Bạn là một chuyên gia biên tập video giàu kinh nghiệm. Nhiệm vụ của bạn là phân tích nội dung video được gửi đến, sau đó viết lại thành một kịch bản mới hấp dẫn hơn, tối ưu retention và có cấu trúc rõ ràng."
          },
          {
            role: "user",
            content: scriptContent
          }
        ]
      })
    });

    const data = await completion.json();

    if (completion.status !== 200 || !data.choices || !data.choices[0]?.message?.content) {
      return res.status(400).json({
        error: "AI returned an empty response.",
        raw: data
      });
    }

    return res.status(200).json({ result: data.choices[0].message.content });
  } catch (error) {
    return res.status(500).json({ error: "Server error", detail: error.message });
  }
}
