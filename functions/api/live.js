// GET /api/live – strona publiczna czyta stąd ostatnie wyniki z KV.

export async function onRequestGet({ env }) {
  const data = await env.LIVE.get("live");
  if (!data) {
    return new Response(JSON.stringify({ error: "no_data" }), {
      status: 404,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    });
  }
  return new Response(data, {
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=30" },
  });
}
