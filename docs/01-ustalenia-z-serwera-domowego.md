# Ustalenia z serwera domowego – uzupełnienie planu C

> Wklej ten plik do Claude Code razem z `C-claude-code-strona-publiczna.md` i `00-kontrakt-danych.md`.
> Tam, gdzie ten plik mówi co innego niż plan C, **ma pierwszeństwo ten plik**.
> `functions/api/push.js` i `functions/api/live.js` zostają bez zmian.

## Co serwer domowy już wysyła (stan wdrożony)

- Payload zgodny z `00-kontrakt-danych.md`, `version: 1`.
- Nowe opcjonalne pole **`match_on`** (bool): `true` w oknie meczowym (od 5 min przed meczem do 2,5 h po),
  `false` poza nim. `push.js` przepuszcza je bez zmian, bo sprawdza tylko `version` i tablice.
- `updated` ma zawsze offset Europe/Warsaw, np. `2026-11-08T17:03:12+01:00`. Parsuj przez `new Date(updated)`
  i wyświetlaj w czasie lokalnym przeglądarki.
- `teams[]` i `duets[]` przychodzą już posortowane (`round_net`↓, potem `total`↓). Domyślny widok może je
  pokazać w tej kolejności, a sortowanie po kliknięciu nagłówka działa jak w planie C.
- `duets` może być `[]` – wtedy w zakładce Duety komunikat „Brak duetów”.
- `round_points` może być `null` → „–” (`round_net` jest wtedy liczone z 0 + prowizja).
- Duet z `complete: false`: jednej drużyny nie ma w `teams[]`. Po rozwinięciu wiersza tej drużyny nie da się
  znaleźć po slugu – pokaż samą nazwę (`team1_name`/`team2_name`) z „–” zamiast punktów.
- Rytm wysyłki: po każdym nowym odczycie z fantasy – w trakcie meczów co ~3 min, poza meczami co ~30 min;
  od razu przy zmianie `match_on`, a heartbeat (`PUSH_HEARTBEAT_MINUTES`) tylko jako zabezpieczenie.
  Gdy serwer domowy straci sesję fantasy, nie wysyła **nic**. Wtedy jedynym sygnałem jest starzejące się `updated`.

## Korekta planu C: znacznik świeżości

Progi z planu C (10 min / 2 h) dawałyby żółte „opóźnione” poza meczami, choć wszystko działa
(dane przychodzą wtedy co ~30 min). Nowe zasady, liczone z `updated` względem teraz, odświeżane co 30 s:

Próg „opóźnione” = interwał odczytu serwera + 10 min zapasu. Interwały przychodzą w opcjonalnych polach
`interval_live_minutes` / `interval_idle_minutes` (z `CACHE_SECONDS` / `IDLE_CACHE_SECONDS` serwera, więc zmiana
w `.env` przenosi się na stronę sama); bez nich domyślnie 3 / 30 min.

| `match_on` | wiek `updated` | znacznik |
|---|---|---|
| `true` lub brak pola | ≤ live + 10 (domyślnie 13 min) | zielona kropka „na żywo” |
| `true` lub brak pola | powyżej progu | żółta „opóźnione (X min temu)” |
| `false` | ≤ idle + 10 (domyślnie 40 min) | neutralna/szara kropka „aktualne · brak meczów” (bez „na żywo”) |
| `false` | powyżej progu | żółta „opóźnione (X min temu)” |
| dowolne | > max(2 h, 2 × próg) | szara „ostatni stan z <data, godzina>” (spokojny ton, jak w planie C) |

Nagłówek: przy `match_on: false` zamiast „N. kolejka – na żywo” pokaż „N. kolejka”.

Uwaga: `live.js` zwraca `cache-control: public, max-age=30`, więc do 30 s opóźnienia jest normalne
i nie wymaga obsługi.

## Korekta: zakładka Drużyny – dwie tabele

Jak w Duetach: **Drużyny – kolejka** (`#`, Drużyna, Kolejka wyróżniona, Suma; domyślnie `round_net`↓)
i **Drużyny – klasyfikacja** (`#`, Drużyna, Suma wyróżniona, Kolejka z dopiskiem prowizji; domyślnie `total`↓).
Na szerokim ekranie obok siebie, na telefonie jedna pod drugą; szeroki układ na obu zakładkach.

## Korekta planu C: zakładka Duety – dwie tabele

Zamiast jednej tabeli duetów – dwie (na szerokim ekranie obok siebie albo jedna pod drugą, na telefonie
zawsze jedna pod drugą):

1. **Duety – kolejka** – jak w planie C: `#`, Nazwa (`group_name`) z menedżerami mniejszym drugim wierszem,
   Kolejka (`round_net`, wyróżnione), Suma (`total`). Domyślnie `round_net`↓, remis `total`↓.
2. **Duety – klasyfikacja** – `#`, Nazwa z menedżerami, Suma (`total`, wyróżnione), Kolejka (`round_net`).
   Domyślnie `total`↓, remis `round_net`↓.

Obie tabele: ex aequo (1, 2, 2, 4), rozwijanie wiersza z obiema drużynami, etykieta „niepełne dane”,
„Brak duetów” przy pustej liście. Sortowanie po kliknięciu nagłówka działa w każdej tabeli niezależnie,
a rozwinięcie wiersza w jednej nie rozwija go w drugiej.

Punktów „live” (z trwających meczów) tu nie ma – kontrakt ich nie zawiera; mają je tylko w lokalnym panelu
serwera domowego. Kontrakt `00` bez zmian.

## Dodatkowe dane do testowego `curl` w README

Payload testowy z planu C poszerz tak, żeby pokrywał:
- `"match_on": true` (oraz drugi wariant z `false`, żeby sprawdzić oba znaczniki),
- drużynę z `"round_points": null`,
- drużynę z prowizją (`"penalty": -4`),
- duet z `"complete": false` (slug drużyny nieobecnej w `teams`),
- osobną komendę z `"duets": []`.

## Dodatkowe kryteria akceptacji

8. `match_on: false` i `updated` sprzed 25 min → „aktualne · brak meczów”, nie żółte.
9. `match_on: true` i `updated` sprzed 15 min (bez pól interwałów) → żółte „opóźnione (15 min temu)”.
10. Payload bez pola `match_on` → progi jak przy `match_on: true`.
11. `duets: []` → „Brak duetów” w obu tabelach duetów, bez błędów w konsoli.
12. Zakładka Duety pokazuje dwie tabele; kolejność w „Duety – klasyfikacja” zgodna z `total` malejąco.
13. Zakładka Drużyny pokazuje dwie tabele; kolejność w „Drużyny – klasyfikacja” zgodna z `total` malejąco.
