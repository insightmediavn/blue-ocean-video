export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { scriptContent } = req.body;

  // Log để debug
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL_ID || "openai/gpt-4o";

  if (!apiKey) {
    return res.status(401).json({
      error: "Missing API key - OPENROUTER_API_KEY is undefined.",
      env: process.env,
    });
  }

  if (!scriptContent || scriptContent.trim().length < 20) {
    return res.status(400).json({ error: "Script content too short." });
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
            content: "You are an AI script editor helping American seniors."
          },
          {
            role: "user",
            content: scriptContent
          }
        ]
      })
    });

    const raw = await response.text();
    let data = {};
    try {
      data = JSON.parse(raw);
    } catch (err) {
      return res.status(500).json({ error: "Failed to parse AI response", raw });
    }

    if (!data.choices || !data.choices[0]?.message?.content) {
      return res.status(400).json({
        error: "AI returned an empty response.",
        debug: data
      });
    }

    return res.status(200).json({ output: data.choices[0].message.content });

  } catch (err) {
    return res.status(500).json({
      error: "Fetch failed",
      detail: err.message
    });
  }
}
