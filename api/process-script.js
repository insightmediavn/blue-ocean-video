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

  if (!scriptContent || scriptContent.trim().length < 20) {
    return res.status(400).json({ error: "Script content is too short or empty." });
  }

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: "You are an AI script editor specialized in improving video scripts for American seniors. Be warm, professional, and clear."
          },
          {
            role: "user",
            content: scriptContent
          }
        ]
      })
    });

    const raw = await response.text(); // đọc phản hồi thô từ API
    console.log("🔍 Raw response from OpenRouter:\n", raw);

    let data;
    try {
      data = JSON.parse(raw);
    } catch (jsonErr) {
      return res.status(500).json({
        error: "Failed to parse response from AI.",
        raw
      });
    }

    if (!data.choices || !data.choices[0]?.message?.content) {
      return res.status(400).json({
        error: "AI returned an empty response.",
        debug: data
      });
    }

    return res.status(200).json({ output: data.choices[0].message.content });

  } catch (error) {
    return res.status(500).json({
      error: "AI request failed.",
      detail: error.message
    });
  }
}
