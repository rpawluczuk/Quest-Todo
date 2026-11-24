# Kalendarz historii nawyku — komponent prezentacyjny

`src/components/HabitHistoryCalendar.tsx` eksportuje domyślnie
`HabitHistoryCalendar` oraz typ `HabitHistoryCalendarProps`:

```tsx
import HabitHistoryCalendar from './components/HabitHistoryCalendar'
import type { HabitHistory } from './types/HabitHistory'

function HistoryPreview({ history }: { history: HabitHistory }) {
  return <HabitHistoryCalendar history={history} />
}
```

Jedyny prop, `history`, to pełna odpowiedź
`GET /api/habits/{id}/history?year=YYYY`, opisana w
[kontrakcie backendu](../backend/HABIT_HISTORY.md). Typy w
`src/types/HabitHistory.ts` odwzorowują faktyczne pola i wartości `null`.

Komponent pokazuje 12 miesięcy w kolejności kalendarzowej, po dwa na wiersz,
a na ekranach do 640 px w jednej kolumnie. Wykorzystuje kolory motywu Quest
Todo z `index.css`; własne style importuje z `HabitHistoryCalendar.css`.

Siatki miesięcy powstają wyłącznie z roku, bez przesuwania dat względem
strefy przeglądarki. Wykonania i statusy dni pochodzą z `days`. Puste miejsca
poza miesiącem nie mają kwadratów. Wynik każdego wiersza pochodzi z `weeks`
przez identyczne `weekStart`, także na granicach miesięcy i lat. Komponent
nie oblicza statusów, progów ani liczników wykonań.

Dni mają opisy dla czytników ekranu. `INACTIVE` nie zawiera dokładnej
przyczyny w API, więc opis wymienia możliwe kategorie bez przypisywania
konkretnej pauzy lub daty zakończenia. Zapisane wykonanie jest zachowane
także w wygaszonym dniu. Znaczniki tygodni rozwijają pełny opis przez
kliknięcie, dotyk albo Enter/Space; `summary` ma też pełną nazwę dostępną.
`NEUTRAL` bez wymaganego progu pokazuje kreskę, a nie `0/0`.

Weryfikacja:

- `npm test` — układ dat, niedzielny początek miesiąca, 29 lutego, wspólne
  poniedziałki, znaczniki i brak przesunięć między strefami.
- `npm run build` i `npm run lint`.
- `node test/habitHistoryCalendar.browser.mjs` przy działającym Vite
  (`TEST_URL`, domyślnie `http://127.0.0.1:5197`). Test montuje komponent
  w izolowanym podglądzie, sprawdza desktop, telefon, klawiaturę, dotyk,
  strefy przeglądarki i brak żądań API. Korzysta z tej samej lokalnej
  instalacji Playwright/Edge co istniejące testy przeglądarkowe repozytorium.

Integracja z widokiem aplikacji, pobieranie danych i wybór roku należą do etapu 3.
