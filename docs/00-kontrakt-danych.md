# Kontrakt danych – live.json (wersja 1)

Wspólny format dla trzech części:
- serwer domowy (`fantasy-live`) go **wysyła**,
- funkcja Cloudflare `/api/push` go **zapisuje** w KV,
- strona publiczna (`fantasy-public`) go **czyta** z `/api/live`.

Każda zmiana formatu = podbicie `version` i aktualizacja wszystkich trzech części.

```json
{
  "version": 1,
  "league": { "id": 641, "name": "FMForumDiscord III" },
  "round": 14,
  "updated": "2026-11-08T17:03:12+01:00",
  "match_on": true,
  "interval_live_minutes": 3,
  "interval_idle_minutes": 30,
  "teams": [
    {
      "slug": "poznan-festung",
      "name": "Poznań Festung",
      "round_points": 57,
      "penalty": 0,
      "round_net": 57,
      "total": 762
    }
  ],
  "duets": [
    {
      "managers": "laki & Ernie",
      "group_name": "Poznań Doi Kozy",
      "team1_slug": "lelek-kozodoj",
      "team2_slug": "poznan-festung",
      "team1_name": "Lelek Kozodój",
      "team2_name": "Poznań Festung",
      "round_net": 112,
      "total": 1582,
      "complete": true
    }
  ],
  "received_at": "2026-11-08T16:03:13.000Z"
}
```

## Znaczenie pól

| Pole | Opis |
|---|---|
| `round` | numer bieżącej kolejki (z nagłówka „N. kolejka – info”), `null` gdy nieznany |
| `updated` | ISO 8601 z offsetem Europe/Warsaw (`+01:00` / `+02:00`) – kiedy serwer domowy **odczytał** dane z fantasy |
| `match_on` | *opcjonalne* (bool) – `true`, gdy trwa okno meczowe (od 5 min przed meczem do 2,5 h po), czyli serwer czyta fantasy co ~3 min; `false` poza meczami (odczyt co ~30 min). Brak pola = nieznane |
| `interval_live_minutes` | *opcjonalne* (liczba > 0) – co ile minut serwer czyta fantasy w trakcie meczów (`CACHE_SECONDS / 60`), czyli jak często zmienia się `updated` przy `match_on: true` |
| `interval_idle_minutes` | *opcjonalne* (liczba > 0) – to samo poza meczami (`IDLE_CACHE_SECONDS / 60`) |
| `received_at` | dopisuje Cloudflare przy zapisie – serwer domowy go **nie** wysyła |
| `teams[]` | posortowane: `round_net` malejąco, przy remisie `total` malejąco |
| `teams[].round_points` | „Punkty w kolejce” ze strony drużyny (`null` gdy nie udało się odczytać) |
| `teams[].penalty` | „Prowizja za transfery” (≤ 0) |
| `teams[].round_net` | `round_points + penalty` (`null` liczone jako 0) – po tym się sortuje |
| `teams[].total` | suma punktów w sezonie (`total_points` z `/ranking-list`) |
| `duets[]` | posortowane jak `teams[]`; może być pustą listą (brak pliku duetów na serwerze domowym) |
| `duets[].round_net` | suma `round_net` obu drużyn |
| `duets[].total` | suma `total` obu drużyn |
| `duets[].complete` | `false`, jeśli którejś drużyny z pary nie ma w danych (wtedy sumy liczone z tego, co jest) |

Nazwy drużyn w `duets[]` bierzemy z `teams[]` (aktualne, z polskimi znakami), a nie z pliku `duety_cmf.json`
(wyjątek: drużyny brak w `teams[]` – wtedy nazwa z pliku i `complete: false`).
Łączenie zawsze po `slug`.

Pola opcjonalne i nieznane: czytelnik ignoruje pola, których nie zna, i nie zakłada, że pole opcjonalne
jest obecne. Dodanie pola opcjonalnego nie wymaga podbicia `version`; zmiana znaczenia lub usunięcie pola – wymaga.

## Kiedy serwer domowy wysyła dane

- Po **każdym nowym odczycie** z fantasy (nowe `updated`): w trakcie meczów co `interval_live_minutes` (~3 min),
  poza meczami co `interval_idle_minutes` (~30 min) – niezależnie od tego, czy punkty się zmieniły.
- Od razu, gdy zmieni się `round`, `match_on`, `teams` lub `duets` (hash z tych pól), np. `match_on` po końcu okna meczowego.
- Heartbeat `PUSH_HEARTBEAT_MINUTES` (domyślnie 30) to tylko zabezpieczenie: ponownie wysyła ostatni stan,
  ale **nie** odświeża `updated`, więc nie wpływa na znacznik świeżości.
- Gdy fantasy wymaga zalogowania (brak sesji) albo odczyt się nie udał – **nic** nie jest wysyłane.
  Na stronie publicznej zostaje ostatni stan, a `updated` się starzeje; to jedyny sygnał awarii.
- Limit darmowy KV (1000 zapisów/dobę): realnie ~200 zapisów w dzień meczowy, ~50 w dzień bez meczów.

## Znacznik świeżości na stronie publicznej

Próg „opóźnione” = interwał + 10 min zapasu: `interval_live_minutes` przy `match_on: true` lub braku pola,
`interval_idle_minutes` przy `match_on: false`. Brak pól interwałów (albo złe wartości) → 3 / 30 min,
czyli progi 13 / 40 min. „Ostatni stan z …” po przekroczeniu max(2 h, 2 × próg).
Zmiana `CACHE_SECONDS` / `IDLE_CACHE_SECONDS` w `.env` serwera przenosi się więc na stronę bez zmian w kodzie strony.

## Czego w payloadzie być NIE może

E-mail, hasło, ciasteczka, tokeny SSO, nagłówki HTTP, komunikaty błędów z treścią odpowiedzi fantasy.
Serializacja ma być jawną whitelistą pól powyżej – nigdy `json.dumps(cały_obiekt)`.
