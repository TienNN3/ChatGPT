// Máy nhận cục bộ để chuyển dữ liệu từ trang Facebook (CSP chặn fetch/clipboard) về file staging.
// Trong trang: tạo <form method="post" action="http://127.0.0.1:4176/"> với <textarea name="payload"> chứa JSON rồi submit.
// Usage: node scripts/receive-staging.mjs <output.json> [port=4176]
import { createServer } from "node:http";
import { writeFile } from "node:fs/promises";

const output = process.argv[2];
const port = Number(process.argv[3] || 4176);
if (!output) throw new Error("Usage: node scripts/receive-staging.mjs <output.json> [port]");
createServer(async (request, response) => {
  response.setHeader("access-control-allow-origin", "*");
  if (request.method === "POST") {
    let body = "";
    for await (const chunk of request) body += chunk;
    const payload = request.headers["content-type"]?.includes("application/x-www-form-urlencoded") ? new URLSearchParams(body).get("payload") || "" : body;
    try { JSON.parse(payload); } catch { response.statusCode = 400; response.end("invalid JSON"); return; }
    await writeFile(output, `${payload}\n`);
    response.setHeader("content-type", "text/plain; charset=utf-8");
    response.end(`saved ${payload.length} chars to ${output}`);
    return;
  }
  response.end("receiver ready");
}).listen(port, "127.0.0.1", () => console.log(`receiver http://127.0.0.1:${port} → ${output}`));
