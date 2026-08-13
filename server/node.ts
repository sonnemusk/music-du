/**
 * VPS / local entry: Node HTTP + Hono API + Vite (dev) or static SPA (prod).
 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import type { ViteDevServer } from "vite";
import { createApp } from "./app.js";
import {
  attachChartCoverWarmer,
  attachChartDiskCache,
  startChartWarmLoop,
} from "./charts.js";
import { createChartCoverWarmer, createChartDiskCache } from "./charts-disk.js";
import { CHKSZ_APIKEY, HOST, PORT, ROOT } from "./config.js";

// VPS durable chart + cover warm (not used on Cloudflare Workers)
attachChartDiskCache(createChartDiskCache());
attachChartCoverWarmer(createChartCoverWarmer());

const isProd = process.env.NODE_ENV === "production";
// Prefer project dist/client; if ROOT already points at dist (misconfig), still find client/
const clientDist = fs.existsSync(path.join(ROOT, "dist/client"))
  ? path.join(ROOT, "dist/client")
  : path.join(ROOT, "client");

const MAX_BODY = 2 * 1024 * 1024; // 2 MB

async function readBody(req: http.IncomingMessage): Promise<Buffer | undefined> {
  if (!req.method || ["GET", "HEAD"].includes(req.method)) return undefined;
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const b = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += b.length;
    if (total > MAX_BODY) {
      const err = new Error("payload too large") as Error & { statusCode?: number };
      err.statusCode = 413;
      throw err;
    }
    chunks.push(b);
  }
  const buf = Buffer.concat(chunks);
  return buf.length ? buf : Buffer.alloc(0);
}

async function handleApi(
  api: ReturnType<typeof createApp>,
  req: http.IncomingMessage,
  res: http.ServerResponse
) {
  const host = req.headers.host || `${HOST}:${PORT}`;
  const url = `http://${host}${req.url || "/"}`;
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (v == null) continue;
    // skip hop-by-hop / conflicting
    const lk = k.toLowerCase();
    if (lk === "transfer-encoding" || lk === "connection") continue;
    headers.set(k, Array.isArray(v) ? v.join(",") : v);
  }
  let bodyBuf: Buffer | undefined;
  try {
    bodyBuf = await readBody(req);
  } catch (e: any) {
    if (e?.statusCode === 413) {
      res.statusCode = 413;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: false, error: "payload too large" }));
      return;
    }
    throw e;
  }
  const hasBody = bodyBuf && bodyBuf.length > 0 && req.method && !["GET", "HEAD"].includes(req.method);
  const response = await api.fetch(
    new Request(url, {
      method: req.method,
      headers,
      body: hasBody ? new Uint8Array(bodyBuf!) : undefined,
      // Node undici requires duplex when body is a stream-like payload
      ...(hasBody ? ({ duplex: "half" } as RequestInit) : {}),
    })
  );
  res.statusCode = response.status;
  response.headers.forEach((v, k) => {
    if (k.toLowerCase() === "transfer-encoding") return;
    res.setHeader(k, v);
  });
  if (!response.body) {
    res.end();
    return;
  }
  // Q-2: stream pipe instead of buffering entire audio/body in memory
  const reader = response.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        if (!res.write(Buffer.from(value))) {
          await new Promise<void>((r) => res.once("drain", () => r()));
        }
      }
    }
    res.end();
  } catch (e) {
    try {
      res.destroy();
    } catch {
      /* */
    }
    throw e;
  }
}

function serveStaticFile(filePath: string, res: http.ServerResponse) {
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return false;
  const ext = path.extname(filePath).toLowerCase();
  const types: Record<string, string> = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".ico": "image/x-icon",
    ".woff2": "font/woff2",
    ".json": "application/json",
  };
  res.statusCode = 200;
  res.setHeader("Content-Type", types[ext] || "application/octet-stream");
  res.end(fs.readFileSync(filePath));
  return true;
}

async function main() {
  const api = createApp();
  let vite: ViteDevServer | null = null;

  if (!isProd) {
    const { createServer: createVite } = await import("vite");
    vite = await createVite({
      configFile: path.join(ROOT, "vite.config.ts"),
      server: { middlewareMode: true },
      appType: "custom",
    });
  }

  const server = http.createServer(async (req, res) => {
    try {
      const url = req.url || "/";
      const apiPath = (url.split("?")[0] || "/").replace(/\/+$/, "") || "/";
      // Hono also owns /favs and /export (not only /api/*). Vite would otherwise
      // serve the SPA HTML for those short URLs.
      if (url.startsWith("/api/") || apiPath === "/favs" || apiPath === "/export") {
        await handleApi(api, req, res);
        return;
      }

      if (vite) {
        vite.middlewares(req, res, async () => {
          try {
            let template = fs.readFileSync(path.join(ROOT, "client/index.html"), "utf8");
            template = await vite!.transformIndexHtml(url, template);
            res.statusCode = 200;
            res.setHeader("Content-Type", "text/html; charset=utf-8");
            res.end(template);
          } catch (e: any) {
            vite?.ssrFixStacktrace(e);
            res.statusCode = 500;
            res.end(e?.message || "vite error");
          }
        });
        return;
      }

      // production static (path-traversal safe)
      const pathname = decodeURIComponent(url.split("?")[0] || "/");
      const safe = path.normalize(pathname).replace(/^(\.\.[/\\])+/, "").replace(/^[/\\]+/, "");
      const root = path.resolve(clientDist);
      const filePath = path.resolve(root, safe === "" || safe === "." ? "index.html" : safe);
      if (!filePath.startsWith(root + path.sep) && filePath !== root) {
        res.statusCode = 403;
        res.end("Forbidden");
        return;
      }
      if (serveStaticFile(filePath, res)) return;
      // SPA fallback
      const index = path.join(root, "index.html");
      if (serveStaticFile(index, res)) return;
      res.statusCode = 404;
      res.end("Not found — run npm run build");
    } catch (e: any) {
      res.statusCode = 500;
      res.end(e?.message || "server error");
    }
  });

  server.listen(PORT, HOST, () => {
    console.log(
      `Music (${isProd ? "prod" : "dev"}) http://${HOST}:${PORT}`
    );
    // Free .top needs no key — always warm charts on Node
    startChartWarmLoop({ apikey: CHKSZ_APIKEY || undefined });
    console.log("chart warm loop started (12h fresh / 24h ttl, disk cache)");
  });

  const shutdown = () => {
    console.log("shutting down…");
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 8000).unref();
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
