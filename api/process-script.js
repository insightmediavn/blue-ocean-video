/* ----------- extract JSON robust ----------- */
let jsonStr = null;

// 1) nếu có ```json ... ``` hoặc ``` ... ```
const md = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
if (md) jsonStr = md[1];

// 2) nếu còn nội dung escaped trong "content": "\"...\""
if (!jsonStr) {
  const contentMatch = raw.match(/"content"\s*:\s*"([^"]+)"/);
  if (contentMatch) {
    // Giải escape sequence \" \\n ...
    const unescaped = contentMatch[1]
      .replace(/\\"/g, '"')
      .replace(/\\n/g, '\n')
      .trim();

    // bỏ tiền tố json\n nếu có
    jsonStr = unescaped.replace(/^json\s*/i, '');
  }
}

// 3) fallback: lấy mảng bắt đầu bằng [ và kết thúc ]
if (!jsonStr) {
  const arrMatch = raw.match(/\[[\s\S]*\]/);
  if (arrMatch) jsonStr = arrMatch[0];
}

if (!jsonStr) {
  return res.status(400).json({ error: "No JSON found", raw });
}

let scenes;
try {
  scenes = JSON.parse(jsonStr);
} catch (e) {
  return res.status(400).json({ error: "JSON.parse failed", jsonStr });
}
