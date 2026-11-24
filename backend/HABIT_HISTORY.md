# Roczna historia nawyku

`GET /api/habits/{id}/history?year=2026` wymaga zalogowania. Zwraca także
historię zakończonego nawyku. Brak nawyku lub inny właściciel oznacza `404`.
Parametr `year` jest wymagany i przyjmuje liczby całkowite od 1 do 9999;
brak, pusty parametr, inny format i wartości spoza zakresu oznaczają `400`.

Odpowiedź zawiera `id`, `name`, `year`, `today`, `days` i `weeks`.
`today` pochodzi z `HabitCalendar` (Europe/Warsaw). Daty mają format ISO.

- `days`: wszystkie 365 lub 366 dni roku, rosnąco. `completed` oznacza
  istniejący zapis wykonania, niezależnie od statusu dnia. `status` to
  `FUTURE` dla dat po `today`, a dla pozostałych dat `ACTIVE` lub `INACTIVE`.
  Dzień jest aktywny, jeśli mieści się w okresie nawyku i według
  `HabitActivityTimeline.wasActiveOn` miał aktywność. Zachowujemy istniejącą
  interpretację częściowo aktywnego dnia i historii sprzed migracji.
  `INACTIVE` obejmuje dni przed startem, po zakończeniu, PLANNED i pauzy.
- `weeks`: wszystkie tygodnie przecinające rok, rosnąco po poniedziałku
  `weekStart`. Obliczenia obejmują pełny tydzień poniedziałek–niedziela,
  również daty sąsiedniego roku, i są przycięte wyłącznie do okresu nawyku.
  `startDate` i `endDate` są wliczane; `endedOn` jest wykluczany.
  Jeśli występują oba zakończenia, obowiązuje wcześniejsza granica.
- `completedDays`: liczba zapisanych wykonań w tak przyciętym tygodniu.
  `targetDays`: ostatni próg z `effectiveFrom <= weekStart`, albo `null`.
  Obecny zapis konfiguracji normalizuje zmianę w środku tygodnia do
  poniedziałku tego tygodnia; odczyt nie przepisuje historii progów.
- `requiredDays`: `ceil(targetDays * liczba dni okresu / 7)`, zgodnie
  z `HabitRegularity`. Wartość jest `null`, gdy nie ma progu lub tydzień
  nie przecina okresu nawyku. Miesiąc, rok i dzisiejsza data nie obniżają progu.
- `status`: `NEUTRAL`, gdy tydzień jest poza okresem nawyku, w całości
  przyszły, bez progu albo oceniany zakres nie jest w pełni aktywny
  (`HabitActivityTimeline.fullyActive`, także krótkie pauzy).
  W pozostałych przypadkach `MET` oznacza osiągnięty próg,
  `IN_PROGRESS` nieosiągnięty próg w otwartym okresie,
  a `MISSED` nieosiągnięty próg dopiero po zakończeniu okresu.
  Dzień końcowy zamyka się po jego upływie. Przyznane punkty nie wpływają na wynik.

Przykładowy fragment odpowiedzi (tablice skrócone; API zwraca wszystkie dni i tygodnie):

```json
{
  "id": 42,
  "name": "Czytanie",
  "year": 2026,
  "today": "2026-11-24",
  "days": [
    {"date": "2026-11-23", "completed": true, "status": "ACTIVE"},
    {"date": "2026-11-24", "completed": false, "status": "ACTIVE"},
    {"date": "2026-11-25", "completed": false, "status": "FUTURE"}
  ],
  "weeks": [
    {"weekStart": "2026-11-16", "completedDays": 2, "targetDays": 3, "requiredDays": 3, "status": "MISSED"},
    {"weekStart": "2026-11-23", "completedDays": 1, "targetDays": 3, "requiredDays": 3, "status": "IN_PROGRESS"}
  ]
}
```

Odczyt działa w transakcji `readOnly`, bez blokady zapisu i bez rozliczania
nagród. Wykonuje cztery zapytania: nawyk z właścicielem w warunku, wszystkie
wykonania w rozszerzonym zakresie dat, historia progów i historia aktywności.
Nie wymaga migracji ani tygodniowych snapshotów. Logika istniejących rozliczeń
regularności i premii pozostaje w dotychczasowych serwisach.
