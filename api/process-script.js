export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { scriptContent } = req.body;
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model  = process.env.OPENROUTER_MODEL_ID || "openai/gpt-4o";

  if (!apiKey?.startsWith("sk-or-")) {
    return res.status(401).json({ error: "Missing / invalid OPENROUTER_API_KEY." });
  }
  if (!scriptContent || scriptContent.trim().length < 10) {
    return res.status(400).json({ error: "Script too short." });
  }

  /* ------- call OpenRouter ------- */
  const orRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method : "POST",
    headers: {
      Authorization : `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "user", content:
`Dưới đây là một đoạn kịch bản video:

${scriptContent}

Trích xuất tối đa 15 từ khóa quan trọng nhất.  
Chỉ trả về JSON đúng định dạng: {"keywords": ["..."]}  – KHÔNG thêm markdown.`}
      ],
      temperature: 0.3
    })
  });

  const raw = await orRes.text();
  console.log("🔵 RAW TEXT FROM OPENROUTER:\n", raw);

  /* ------- bóc JSON -------- */
  const mdMatch  = raw.match(/```(?:json)?\\s*([\\s\\S]*?)\\s*```/i);   // có ```json
  const plainObj = raw.match(/\\{[\\s\\S]*\\}/);                       // fallback {...}

  const jsonString = mdMatch?.[1] ?? mdMatch?.[0] ?? plainObj?.[0];

  if (!jsonString) {
    return res.status(400).json({ error: "Không tìm thấy JSON trong phản hồi.", raw });
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonString);
  } catch (e) {
    return res.status(400).json({ error: "JSON.parse thất bại.", jsonString });
  }

  if (!Array.isArray(parsed.keywords)) {
    return res.status(400).json({ error: "Thiếu hoặc sai trường 'keywords'.", parsed });
  }

  return res.status(200).json({ result: parsed });
}
