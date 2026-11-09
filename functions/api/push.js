// POST /api/push – serwer domowy wysyła tu gotowy JSON z wynikami.
// Wymaga nagłówka: Authorization: Bearer <PUSH_TOKEN>
// Bindingi Pages: KV "LIVE", sekret "PUSH_TOKEN".

const MAX_BYTES = 256 * 1024;
const enc = new TextEncoder();

function tokenOk(header, secret) {
  if (!secret || !header || !header.startsWith("Bearer ")) return false;
  const a = enc.encode(header.slice(7));
  const b = enc.encode(secret);
  if (a.byteLength !== b.byteLength) return false;
  return crypto.subtle.timingSafeEqual(a, b);
}

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

export async function onRequestPost({ request, env }) {
  if (!tokenOk(request.headers.get("authorization"), env.PUSH_TOKEN)) {
    return json(401, { error: "unauthorized" });
  }
  const text = await request.text();
  if (text.length > MAX_BYTES) return json(413, { error: "too_large" });

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return json(400, { error: "invalid_json" });
  }
  if (data?.version !== 1 || !Array.isArray(data.teams) || !Array.isArray(data.duets)) {
    return json(400, { error: "invalid_schema" });
  }

  data.received_at = new Date().toISOString();
  await env.LIVE.put("live", JSON.stringify(data));
  return json(200, { ok: true, teams: data.teams.length, duets: data.duets.length });
}

export const onRequest = () => json(405, { error: "method_not_allowed" });
