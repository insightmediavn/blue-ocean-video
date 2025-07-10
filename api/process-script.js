export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST allowed" });
  }

  const { scriptContent, translationStyle = "neutral", targetAudience = "general" } = req.body;
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model  = process.env.OPENROUTER_MODEL_ID || "openai/gpt-4o";

  if (!apiKey?.startsWith("sk-or-")) {
    return res.status(401).json({ error: "Missing / invalid OPENROUTER_API_KEY" });
  }
  if (!scriptContent || scriptContent.trim().length < 20) {
    return res.status(400).json({ error: "Script too short" });
  }

  /* -------- Build prompt -------- */
  const sysPrompt = `
You are an expert video-production assistant.

When given a Vietnamese script you must:

1. **Split** it into logical scenes (one or two sentences per scene).
2. **Translate** each scene to English in the style **${translationStyle}**, suitable for **${targetAudience}**.
3. Extract **2-4 image keywords** (EN) that best visualise that scene.
4. Create a short **mid-journey / image prompt** that could illustrate the scene (no camera settings).

Return **ONLY** valid JSON like:

[
  {
    "vi": "Câu tiếng Việt ...",
    "en": "English line ...",
    "keywords": ["keyword1","keyword2"],
    "prompt": "image prompt ..."
  }
]`;

  try {
    const orRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method : "POST",
      headers: {
        Authorization : `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: sysPrompt.trim() },
          { role: "user",   content: scriptContent.trim() }
        ],
        temperature: 0.4
      })
    });

    const raw = await orRes.text();
    console.log("🔵 RAW AI TEXT:\n", raw);

    /* ---- extract JSON even if wrapped in ```json ... ``` ---- */
    const md      = raw.match(/```(?:json)?\\s*([\\s\\S]*?)\\s*```/i);
    const jsonStr = md?.[1] || md?.[0] || raw.match(/\\[[\\s\\S]*\\]/)?.[0];

    if (!jsonStr) {
      return res.status(400).json({ error: "No JSON found", raw });
    }

    let scenes;
    try {
      scenes = JSON.parse(jsonStr);
    } catch (e) {
      return res.status(400).json({ error: "JSON.parse failed", jsonStr });
    }

    if (!Array.isArray(scenes) || scenes.length === 0) {
      return res.status(400).json({ error: "Parsed JSON is not an array", scenes });
    }

    return res.status(200).json({ scenes });
  } catch (err) {
    return res.status(500).json({ error: "AI call failed", detail: err.message });
  }
}
