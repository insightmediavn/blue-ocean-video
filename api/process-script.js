export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { scriptContent } = req.body;
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = "openai/gpt-4o";

  if (!apiKey || !scriptContent || scriptContent.trim().length < 20) {
    return res.status(400).json({ error: "Missing API key or script content too short." });
  }

  const prompt = `
You are a helpful assistant that analyzes video scripts. Please:

1. Split the script into scenes (each 5-10 seconds max).
2. Translate each scene to English (if not already).
3. Extract visual image keywords for each scene.
4. Suggest a descriptive image or video prompt (no camera instructions).
5. Return ONLY valid JSON in the following format:

{
  "scenes": [
    {
      "scene": "Translated scene line here...",
      "image_keywords": ["keyword1", "keyword2"],
      "prompt": "Prompt to generate image or search video"
    }
  ]
}
Do NOT include extra commentary or explanation. Only return JSON.
Here's the script:
${scriptContent}
`;

  try {
    const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "user", content: prompt }
        ],
        temperature: 0.3,
      }),
    });

    const raw = await aiRes.text();

    // Debug raw OpenRouter output
    console.log("🧪 RAW AI RESPONSE:\n", raw);

    const parsedJsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!parsedJsonMatch) {
      return res.status(400).json({ error: "AI response missing JSON structure.", raw });
    }

    let parsed;
    try {
      parsed = JSON.parse(parsedJsonMatch[0]);
    } catch (err) {
      return res.status(400).json({ error: "Failed to parse JSON.", raw });
    }

    if (!parsed.scenes || !Array.isArray(parsed.scenes)) {
      return res.status(400).json({ error: "Missing or invalid 'scenes' in response.", parsed });
    }

    return res.status(200).json({ result: parsed });

  } catch (error) {
    return res.status(500).json({ error: "Internal server error.", detail: error.message });
  }
}
