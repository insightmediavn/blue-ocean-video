// /pages/api/process-script.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { scriptContent } = req.body;
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = "openai/gpt-4o"; // or other

  if (!scriptContent || scriptContent.trim().length < 20) {
    return res.status(400).json({ error: "Script content quá ngắn hoặc không hợp lệ" });
  }

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: "Bạn là chuyên gia tối ưu kịch bản YouTube hấp dẫn, tăng retention, dễ hiểu với người cao tuổi Mỹ."
          },
          {
            role: "user",
            content: scriptContent
          }
        ]
      })
    });

    const data = await response.json();

    if (!data.choices || !data.choices[0]?.message?.content) {
      return res.status(400).json({ error: "AI returned an empty response.", raw: data });
    }

    res.status(200).json({ output: data.choices[0].message.content });
  } catch (err) {
    console.error("AI error:", err);
    res.status(500).json({ error: "Lỗi máy chủ AI", detail: err.message });
  }
}
