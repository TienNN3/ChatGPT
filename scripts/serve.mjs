import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

const publicDir = new URL("../public/", import.meta.url).pathname;
const port = Number(process.env.PORT || 4173);
const mime = { ".html": "text/html; charset=utf-8", ".json": "application/json; charset=utf-8", ".txt": "text/plain; charset=utf-8", ".md": "text/markdown; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8" };
const server = createServer(async (request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const file = normalize(join(publicDir, relative));
  if (!file.startsWith(publicDir)) { response.writeHead(403).end("Forbidden"); return; }
  try {
    const info = await stat(file);
    if (!info.isFile()) throw new Error("not a file");
    response.writeHead(200, { "Content-Type": mime[extname(file)] || "application/octet-stream", ...(pathname.startsWith("/data/") ? { "Cache-Control": "no-cache" } : {}) });
    createReadStream(file).pipe(response);
  } catch { response.writeHead(404).end("Not found"); }
});
server.listen(port, "127.0.0.1", () => console.log(`PTG dashboard: http://127.0.0.1:${port}`));
