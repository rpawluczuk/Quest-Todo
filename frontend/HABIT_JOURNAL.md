# Dziennik nawyku — etap 2

Akcja „Dziennik nawyku” w menu otwiera panel pod wybranym nawykiem.
Dotyczy aktywnych, zaplanowanych, wstrzymanych i zakończonych nawyków.
Wstrzymane nawyki wcześniej nie miały menu: nowe menu mieści się w istniejącym
wierszu akcji obok „Wznów”, bez dodawania wiersza do zwiniętego kafelka.

`HabitJournal` pobiera `GET /api/habits/{id}/entries?page=0&size=3` dopiero
po otwarciu. Pokazuje `totalElements`, trzy najnowsze wpisy, pusty stan,
ładowanie, błąd i ponowienie. Jednocześnie otwarty jest jeden dziennik.
Przycisk zamknięcia otrzymuje focus po otwarciu; zamknięcie zwraca go do menu.

`createHabitJournalStore` wykorzystuje istniejący cache dziennika, z osobną
instancją dla nawyków i wyłącznie interfejsem odczytu. Cache żyje razem ze stroną
Nawyki, zachowuje dane przy zamykaniu panelu i zmianie dnia, rozdziela identyfikatory
rodziców i deduplikuje żądania. Slot podglądu odpowiada stronie 0 o rozmiarze 3;
nie jest współdzielony z cache celów ani historią. Ponowne wejście na stronę tworzy
nowy cache. Opóźnione odpowiedzi trafiają wyłącznie do właściwego nawyku.

`JournalEntryItem` współdzieli prezentację, etykiety, daty Europe/Warsaw
i rozwijanie tekstu z `GoalEntryItem`. Dziennik celu nadal przekazuje swoje
menu i formularz jako elementy React. Dziennik nawyku nie ma formularzy,
operacji zapisu ani pełnej historii; backend nie wymagał zmian.

Weryfikacja:

```shell
npm test
npm run build
node test/habitJournal.browser.mjs
```

Test przeglądarkowy wymaga lokalnego Vite na porcie 5197 (lub `TEST_URL`),
Edge oraz istniejącej instalacji Playwright używanej przez pozostałe testy.
API jest mockowane. Obejmuje statusy, typy wpisów, cache, spóźnione odpowiedzi,
błędy/404, klawiaturę, tekst bez HTML, szerokości 320/360/390/1280 px
i brak żądań zmieniających dane.
