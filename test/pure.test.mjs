// Testy czystych funkcji z public/index.html: node test/pure.test.mjs
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const src = html.slice(html.indexOf("/* pure:start"), html.indexOf("/* pure:end */"));
const { freshness, rankRows, fmtPoints } = new Function(src + "; return { freshness, rankRows, fmtPoints };")();

const now = Date.parse("2026-11-08T17:00:00+01:00");
const ago = (m) => new Date(now - m * 60000).toISOString();

// Plan C (brak match_on)
assert.equal(freshness(ago(5), undefined, now).cls, "live");
assert.equal(freshness(ago(15), undefined, now).text, "opóźnione (15 min temu)");
assert.equal(freshness(ago(180), undefined, now).cls, "old");
assert.match(freshness(ago(180), undefined, now).text, /^ostatni stan z /);
// match_on: true (domyślny interwał 3 min → próg 13 min)
assert.equal(freshness(ago(13), true, now).cls, "live");
assert.equal(freshness(ago(14), true, now).cls, "late");
assert.deepEqual(freshness(ago(15), true, now), { cls: "late", text: "opóźnione (15 min temu)" });
// interwały z payloadu: próg = interwał + 10 min
assert.equal(freshness(ago(15), true, now, { interval_live_minutes: 5 }).cls, "live");
assert.equal(freshness(ago(16), true, now, { interval_live_minutes: 5 }).cls, "late");
assert.equal(freshness(ago(70), false, now, { interval_idle_minutes: 60 }).cls, "ok");
assert.equal(freshness(ago(71), false, now, { interval_idle_minutes: 60 }).cls, "late");
// "ostatni stan" po max(2 h, 2 × próg)
assert.equal(freshness(ago(130), false, now, { interval_idle_minutes: 120 }).cls, "ok");
assert.equal(freshness(ago(131), false, now, { interval_idle_minutes: 120 }).cls, "late");
assert.equal(freshness(ago(261), false, now, { interval_idle_minutes: 120 }).cls, "old");
// złe wartości → domyślne
assert.equal(freshness(ago(41), false, now, { interval_idle_minutes: "x" }).cls, "late");
assert.equal(freshness(ago(13), true, now, { interval_live_minutes: 0 }).cls, "live");
// match_on: false
assert.deepEqual(freshness(ago(25), false, now), { cls: "ok", text: "aktualne · brak meczów" });
assert.equal(freshness(ago(40), false, now).cls, "ok");
assert.equal(freshness(ago(41), false, now).cls, "late");
assert.equal(freshness(ago(121), false, now).cls, "old");
// offset Europe/Warsaw
assert.equal(freshness("2026-11-08T16:55:00+01:00", true, now).cls, "live");
assert.equal(freshness("bzdura", true, now).cls, "old");

// ex aequo 1, 2, 2, 4
const rows = [
  { id: "a", round_net: 50, total: 700 },
  { id: "b", round_net: 40, total: 800 },
  { id: "c", round_net: 40, total: 600 },
  { id: "d", round_net: 30, total: 900 },
];
const r = rankRows(rows, "round_net", "total", "desc");
assert.deepEqual(r.map((x) => x.row.id + x.rank), ["a1", "b2", "c2", "d4"]);
const t = rankRows(rows, "total", "round_net", "desc");
assert.deepEqual(t.map((x) => x.row.id + x.rank), ["d1", "b2", "a3", "c4"]);
const asc = rankRows(rows, "round_net", "total", "asc");
assert.deepEqual(asc.map((x) => x.row.id + x.rank), ["d1", "c2", "b2", "a4"]);
// null traktowany jak najmniejsza wartość
assert.equal(rankRows([{ round_net: null, total: 1 }, { round_net: 3, total: 1 }], "round_net", "total", "desc")[0].row.round_net, 3);

assert.equal(fmtPoints(-6), "−6");
assert.equal(fmtPoints(null), "–");
console.log("OK – wszystkie testy przeszły");
