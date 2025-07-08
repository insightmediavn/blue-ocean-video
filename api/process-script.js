export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { scriptContent } = req.body;
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL_ID || "openai/gpt-4o";

  console.log("🔑 API_KEY=", !!apiKey, "MODEL=", model);

  if (!apiKey || !apiKey.startsWith("sk-or-v1-")) {
    return res.status(401).json({
      error: "API Key missing or invalid.",
      debug: { apiKey, model }
    });
  }

  if (!scriptContent || scriptContent.trim().length < 20) {
    return res.status(400).json({ error: "Script content too short or empty." });
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
          { role: "system", content: "You are an AI script editor specialized in improving video scripts for American seniors." },
          { role: "user", content: scriptContent }
        ]
      })
    });

    const data = await response.json();
    console.log("📡 OpenRouter response:", data);

    if (!data.choices || !data.choices[0]?.message?.content) {
      return res.status(400).json({ error: "AI returned empty or invalid response.", debug: data });
    }

    return res.status(200).json({ output: data.choices[0].message.content });
  } catch (e) {
    return res.status(500).json({ error: "AI request failed", detail: e.message });
  }
}
