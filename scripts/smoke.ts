/**
 * Live smoke against running server (default http://127.0.0.1:8787)
 */
const BASE = (process.env.SMOKE_BASE || "http://127.0.0.1:8787").replace(/\/$/, "");

async function j(path: string, init?: RequestInit) {
  const r = await fetch(BASE + path, init);
  const body = await r.json().catch(() => ({}));
  return { status: r.status, body };
}

async function once(label: string) {
  const lines: string[] = [`=== smoke ${label} ${BASE} ===`];
  const h = await j("/api/health");
  if (!h.body.ok) throw new Error("health failed");
  lines.push(`health ok runtime=${h.body.runtime} has_apikey=${h.body.has_apikey}`);

  const smokeId = `smoke-${Date.now()}`;
  const before = await j("/api/library");
  const put = await j("/api/library", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      playlist: [{ id: smokeId, name: "Smoke Probe", artist: "Auditor" }],
      favorites: before.body.data?.favorites || [],
      history: before.body.data?.history || [],
      curIdx: before.body.data?.curIdx ?? -1,
      revision: before.body.data?.revision,
    }),
  });
  lines.push(`library put ok=${put.body.ok}`);

  const del = await j(`/api/library/playlist/${encodeURIComponent(smokeId)}`, {
    method: "DELETE",
  });
  const list = (del.body.data?.playlist || []).map((t: any) => String(t.id));
  if (list.includes(smokeId)) throw new Error("playlist delete failed");
  lines.push(`playlist delete ok remaining=${list.length}`);

  try {
    const s = await j("/api/search?q=%E5%AD%A4%E5%8B%87%E8%80%85&limit=2");
    lines.push(`search ok=${s.body.ok} n=${(s.body.data || []).length} status=${s.status}`);
    if (s.body.ok && s.body.data?.[0]) {
      const id = s.body.data[0].id;
      const song = await j(`/api/song/${id}`);
      const d = song.body.data || {};
      lines.push(
        `song id=${id} source=${d.source} url_http=${String(d.url || "").startsWith("http")} name=${d.name}`
      );
    }
  } catch (e: any) {
    lines.push(`search/song skipped: ${e.message}`);
  }

  // UI root
  const root = await fetch(BASE + "/");
  lines.push(`root status=${root.status} html=${(await root.text()).includes("root") || root.status === 200}`);

  return lines;
}

const out: string[] = [];
for (const pass of [1, 2]) {
  out.push(...(await once(`pass-${pass}`)), "");
}
const text = out.join("\n");
console.log(text);
if (process.env.SMOKE_OUT) {
  await import("node:fs").then((fs) =>
    fs.writeFileSync(process.env.SMOKE_OUT!, text + "\n", "utf8")
  );
}
