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

Wymagany prop `history` to pełna odpowiedź
`GET /api/habits/{id}/history?year=YYYY`, opisana w
[kontrakcie backendu](../backend/HABIT_HISTORY.md). Typy w
`src/types/HabitHistory.ts` odwzorowują faktyczne pola i wartości `null`.
Opcjonalny `showHeader` (domyślnie `true`) pozwala widokowi strony zastąpić
nagłówek kalendarza własnym nagłówkiem z nawigacją lat, bez powtarzania roku.

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

## Widok aplikacji — etap 3

`src/pages/HabitHistoryPage.tsx` jest dostępny pod
`/habits/{id}/history?year=YYYY`, np. `/habits/42/history?year=2026`.
Akcja „Historia” jest dostępna w menu aktywnych, zakończonych i oczekujących
nawyków. Wejście z kafelka wybiera bieżący rok w Europe/Warsaw.

Widok korzysta z `getHabitHistory` i istniejącego `apiFetch`, zachowując
ciasteczka sesji i obsługę jej wygaśnięcia. Każda zmiana roku aktualizuje URL.
Stare żądanie jest anulowane, jego odpowiedź ignorowana, a wynik powiązany
z ID, rokiem i próbą odczytu. Podczas pobierania nie pokazujemy kalendarza
poprzedniego roku pod nowym nagłówkiem. Brak wykonań jest poprawnym kalendarzem.

„Poprzedni rok” działa do roku 1, „Następny rok” do bieżącego roku;
„Bieżący rok” pozwala wrócić jednym kliknięciem. Bezpośredni URL przyjmuje
cały zakres API 1–9999, także lata przyszłe. Brak roku, duplikaty parametru
i błędne wartości pokazują komunikat oraz przejście do bieżącego roku.
404 ma osobny komunikat; błędy sieci i serwera pozwalają ponowić odczyt.

`App` używa natywnego History API i `popstate`. Pozostałe widoki mają
adresy `/`, `/habits`, `/goals`, `/rewards`. Lista nawyków pozostaje zamontowana,
więc zachowuje wybrany dzień, rozwinięte sekcje i notatki. Powrót z historii
przywraca przewinięcie i fokus kafelka. Przy wejściu bezpośrednim wraca do
`/habits` i nagłówka listy. Wejście z menu respektuje ochronę niezapisanego
dziennika nawyku.

Odświeżenie i bezpośredni link na wspólnym serwerze obsługuje Springowy
`WebPageController`. Statyczny hosting wymaga rewrite do `/index.html`
zgodnie z [RENDER.md](RENDER.md).

`node test/habitHistoryPage.browser.mjs` sprawdza wejście z aktywnego
i zakończonego kafelka, rok w Warszawie na granicy roku, zachowanie listy,
URL/odświeżenie/Wstecz/Dalej, opóźnioną odpowiedź, pusty rok, błędny rok,
404, ponowienie po błędzie oraz desktop i telefon.
