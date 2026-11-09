# fantasy-public

Publiczna strona z punktami ligi Fantasy Ekstraklasy „na żywo” (drużyny i duety), hostowana na
Cloudflare Pages. Serwer domowy wysyła gotowy JSON do `POST /api/push`, strona czyta go z `GET /api/live`.
Strona nic nie wie o logowaniu do fantasy: nie ma tu formularzy, haseł ani połączeń z fantasy.ekstraklasa.org.

## Struktura

```
functions/api/push.js   # POST /api/push – zapis do KV (token Bearer, walidacja, limit 256 KB)
functions/api/live.js   # GET /api/live – odczyt z KV (404 no_data, gdy pusto)
public/index.html       # cała strona: HTML + CSS + JS, bez frameworka, bez kroku budowania i bez CDN
public/_headers         # nagłówki bezpieczeństwa (CSP itd.)
docs/                   # specyfikacja i kontrakt danych
test/pure.test.mjs      # testy logiki świeżości i miejsc ex aequo (node test/pure.test.mjs)
```

## Rozwój lokalny

```bash
cp .dev.vars.example .dev.vars          # PUSH_TOKEN=dev-token
npx wrangler pages dev public --kv LIVE # http://localhost:8788
node test/pure.test.mjs                 # testy logiki (Node 18+)
```

### Testowe dane

Payload A: kilka drużyn (w tym `round_points: null`, prowizja `-4`, remis do ex aequo, nazwa z próbą XSS)
i 2 duety, w tym jeden z `complete: false`. Zmienne `UPDATED` i `MATCH_ON` pozwalają sprawdzić wszystkie
znaczniki świeżości.

```bash
UPDATED=$(date -Iseconds)   # albo: date -Iseconds -d '-25 min' / '-15 min' / '-3 hours'
MATCH_ON=true               # albo: false
curl -sS -X POST http://localhost:8788/api/push \
  -H 'Authorization: Bearer dev-token' -H 'content-type: application/json' \
  --data-binary @- <<EOF
{
  "version": 1,
  "league": { "id": 641, "name": "FMForumDiscord III" },
  "round": 14,
  "updated": "$UPDATED",
  "match_on": $MATCH_ON,
  "teams": [
    { "slug": "poznan-festung", "name": "Poznań Festung", "round_points": 57, "penalty": 0, "round_net": 57, "total": 762 },
    { "slug": "lelek-kozodoj", "name": "Lelek Kozodój", "round_points": 59, "penalty": -4, "round_net": 55, "total": 820 },
    { "slug": "zolta-lodz", "name": "Żółta Łódź", "round_points": 48, "penalty": 0, "round_net": 48, "total": 701 },
    { "slug": "xss-test", "name": "<img src=x onerror=alert(1)>", "round_points": 48, "penalty": 0, "round_net": 48, "total": 650 },
    { "slug": "szczecin-sztorm", "name": "Szczecin Sztorm", "round_points": 41, "penalty": 0, "round_net": 41, "total": 777 },
    { "slug": "brak-odczytu", "name": "Brak Odczytu FC", "round_points": null, "penalty": 0, "round_net": 0, "total": 590 }
  ],
  "duets": [
    { "managers": "laki & Ernie", "group_name": "Poznań Doi Kozy",
      "team1_slug": "lelek-kozodoj", "team2_slug": "poznan-festung",
      "team1_name": "Lelek Kozodój", "team2_name": "Poznań Festung",
      "round_net": 112, "total": 1582, "complete": true },
    { "managers": "Ala & Ola", "group_name": "Morze i Rzeka",
      "team1_slug": "szczecin-sztorm", "team2_slug": "zniknieta-druzyna",
      "team1_name": "Szczecin Sztorm", "team2_name": "Zniknięta Drużyna",
      "round_net": 41, "total": 777, "complete": false }
  ]
}
EOF
```

Wariant bez `match_on` (zachowanie wg progów 10 min / 2 h) i z pustą listą duetów:

```bash
curl -sS -X POST http://localhost:8788/api/push \
  -H 'Authorization: Bearer dev-token' -H 'content-type: application/json' \
  --data-binary @- <<EOF
{ "version": 1, "league": { "id": 641, "name": "FMForumDiscord III" }, "round": 14,
  "updated": "$(date -Iseconds)",
  "teams": [ { "slug": "poznan-festung", "name": "Poznań Festung", "round_points": 57, "penalty": 0, "round_net": 57, "total": 762 } ],
  "duets": [] }
EOF
```

Autoryzacja (oczekiwane kody: 401, 401, 405):

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:8788/api/push -d '{}'
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:8788/api/push -H 'Authorization: Bearer zly' -d '{}'
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8788/api/push
```

Pustą bazę uzyskasz, zatrzymując `wrangler` i usuwając katalog `.wrangler/`.

## Wdrożenie (Cloudflare Pages)

1. Workers & Pages → Create → Pages → Connect to Git → to repozytorium. Build command: brak,
   build output directory: `public`. Katalog `functions/` jest wykrywany automatycznie.
2. Utwórz KV namespace (np. `fantasy-live`) i w ustawieniach projektu dodaj binding KV o nazwie **`LIVE`**
   (Production i Preview).
3. Dodaj sekret **`PUSH_TOKEN`** (np. `openssl rand -hex 32`). Ten sam token ustaw na serwerze domowym.
4. Wdróż ponownie i sprawdź: `curl -X POST https://<projekt>.pages.dev/api/push -H "Authorization: Bearer <token>" ...`.

## Format danych

Opis pól: [docs/00-kontrakt-danych.md](docs/00-kontrakt-danych.md) (`version: 1`).
Ustalenia dotyczące znacznika świeżości i dwóch tabel duetów:
[docs/01-ustalenia-z-serwera-domowego.md](docs/01-ustalenia-z-serwera-domowego.md).
