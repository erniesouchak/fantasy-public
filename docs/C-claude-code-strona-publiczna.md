# Zadanie dla Claude Code: strona publiczna (nowe repo `fantasy-public`)

> Wklej ten plik do Claude Code w pustym katalogu razem z `00-kontrakt-danych.md`
> oraz gotowymi plikami `functions/api/push.js` i `functions/api/live.js`.

## Cel

Statyczna strona na Cloudflare Pages, która pokazuje punkty ligi Fantasy Ekstraklasy „na żywo”
(drużyny i duety). Dane przychodzą z serwera domowego przez `/api/push` i są czytane z `/api/live`.
Strona **niczego nie wie** o logowaniu do fantasy: żadnych formularzy, haseł ani połączeń
z fantasy.ekstraklasa.org.

## Struktura repo

```
fantasy-public/
├── functions/
│   └── api/
│       ├── push.js      # GOTOWE – nie zmieniaj logiki (zapis do KV, token, walidacja)
│       └── live.js      # GOTOWE – odczyt z KV
├── public/
│   ├── index.html       # do zrobienia
│   └── _headers         # do zrobienia
├── .gitignore           # node_modules/, .wrangler/, .dev.vars
├── .dev.vars.example    # PUSH_TOKEN=dev-token
└── README.md
```

Bez frameworka i bez kroku budowania. Jeden `index.html` z wbudowanym CSS i JS.
Bez zewnętrznych CDN i fontów (strona ma działać i być szybka bez nich).

## `public/_headers`

```
/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  X-Frame-Options: DENY
  Content-Security-Policy: default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'
```

## `public/index.html` – wymagania

### Dane
- `fetch('/api/live', {cache: 'no-store'})` przy starcie i co 60 s.
- Odświeżanie wstrzymane, gdy karta jest ukryta (`document.visibilityState`), wznowione natychmiast po powrocie.
- Obsłuż stany:
  - ładowanie (szkielet tabeli, bez migania),
  - `404 no_data` → „Brak danych – serwer jeszcze nic nie wysłał”,
  - błąd sieci → zostaw ostatnie dane na ekranie i pokaż dyskretny komunikat,
  - niezgodna `version` → komunikat „Nieobsługiwany format danych”.
- Wszystkie teksty z danych wstawiane przez `textContent` albo funkcję escapującą – **nigdy** surowe `innerHTML` z danymi.

### Świeżość danych (kluczowe)
Nagłówek: „**N. kolejka – na żywo**” + „aktualizacja: HH:MM” (z `updated`, czas lokalny).
Obok znacznik świeżości liczony z `updated` względem teraz, odświeżany co 30 s
(progi zaktualizowane – patrz `01-ustalenia-z-serwera-domowego.md` i kontrakt `00`):
- ≤ 10 min → zielona kropka „na żywo”,
- 10 min – 2 h → żółta „opóźnione (X min temu)”,
- > 2 h → szara „ostatni stan z <data, godzina>” (poza meczami to normalne – bez alarmującego tonu).

### Widoki
Zakładki **Drużyny | Duety** (zapamiętane w `localStorage`, w `try/catch`; parametr `?tab=duety` ma pierwszeństwo,
żeby dało się wysłać link wprost do duetów).

**Drużyny:** dwie tabele – „kolejka” (`#`, Drużyna, Kolejka (`round_net`, wyróżnione), Suma (`total`))
i „klasyfikacja” (Suma wyróżniona, domyślnie `total`↓) – patrz `01-ustalenia-z-serwera-domowego.md`.
- Prowizja (`penalty < 0`) jako mały czerwony dopisek przy punktach kolejki, np. `43 −6`.
- `round_points: null` → „–”.
- Sortowanie po kliknięciu nagłówka kolumny (Kolejka / Suma), domyślnie Kolejka malejąco.
- Miejsce ex aequo przy równych punktach (1, 2, 2, 4).

**Duety:** `#`, Nazwa (`group_name`) z menedżerami (`managers`) mniejszym drugim wierszem, Kolejka, Suma.
- Kliknięcie w wiersz rozwija obie drużyny: nazwa, punkty w kolejce, prowizja, suma.
- `complete: false` → mała etykieta „niepełne dane”.
- Te same zasady sortowania i ex aequo co wyżej.

Nazwa drużyny może być linkiem do `https://fantasy.ekstraklasa.org/user-team/view/<slug>`
(`target="_blank" rel="noopener noreferrer"`).

### Wygląd
- Język polski, `<html lang="pl">`, tytuł strony „Fantasy Live – FMForumDiscord III” (nazwa ligi z danych).
- Mobile first: ma się dobrze czytać na telefonie (~360 px), bez poziomego przewijania strony;
  na szerokim ekranie maks. ok. 720 px szerokości, wyśrodkowane.
- Jasny i ciemny motyw przez `prefers-color-scheme`, kolory jako zmienne CSS na `:root`.
- Liczby wyrównane do prawej, `font-variant-numeric: tabular-nums`.
- Pierwsze trzy miejsca subtelnie wyróżnione (np. kolor numeru), bez krzykliwych grafik.
- Zmiana punktów od poprzedniego odświeżenia: krótkie podświetlenie komórki (ok. 2 s),
  wyłączone przy `prefers-reduced-motion`.
- Stopka: „Dane: Fantasy Ekstraklasa · nieoficjalne zestawienie”.

## Rozwój lokalny

```bash
npm i -g wrangler   # albo npx wrangler
cp .dev.vars.example .dev.vars
npx wrangler pages dev public --kv LIVE
```
Testowe dane: w `README` umieść gotową komendę `curl -X POST localhost:8788/api/push ...`
z przykładowym payloadem zgodnym z kontraktem (kilka drużyn i 2 duety, w tym jeden z `complete: false`
i jedna drużyna z prowizją), żeby dało się sprawdzić wszystkie stany bez serwera domowego.

## `README.md`

Krótko: co to jest, struktura, rozwój lokalny, wdrożenie (odsyłacz: bindingi `LIVE` i sekret `PUSH_TOKEN` w Pages),
format danych (odsyłacz do kontraktu).

## Kryteria akceptacji

1. `wrangler pages dev` + testowy `curl` → strona pokazuje drużyny i duety, przełącznik zakładek działa, `?tab=duety` otwiera duety.
2. `POST /api/push` bez tokenu lub ze złym → 401; z dobrym → 200; `GET /api/push` → 405.
3. Pusta baza → komunikat „Brak danych…”, bez błędów w konsoli.
4. Zmiana `updated` na sprzed 3 godzin → szary znacznik „ostatni stan z…”.
5. Nazwa drużyny `<img src=x onerror=alert(1)>` w testowym payloadzie wyświetla się jako tekst.
6. Widok 360 px: brak poziomego przewijania, tabela czytelna. Działa w trybie jasnym i ciemnym.
7. W repo nie ma `.dev.vars`, tokenów ani adresów e-mail.
