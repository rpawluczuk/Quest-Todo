# Poczekalnia nawyków — etap 1

## Udostępnienie i kompatybilność

`Habit.activityStatus` przechowuje `ACTIVE`, `PLANNED` lub `PAUSED`.
Dotychczasowe pole odpowiedzi `status` (`ACTIVE`, `UPCOMING`, `FINISHED`) nadal
opisuje wynik istniejących zasad kalendarza i zakończenia na wybrany dzień.
Nie zastępuj jednego pola drugim. Frontend nie zmienia się w tym etapie.

**Flaga `app.habits.waiting-room-enabled` jest domyślnie wyłączona.**
Nowe nawyki `ACTIVE`, odczyt historii i idempotentne ustawienie bieżącego statusu
działają także z wyłączoną flagą. Utworzenie `PLANNED` oraz rzeczywista zmiana
statusu zwracają wtedy `503` z komunikatem biznesowym.

Obecny `HabitBonusSettlementJob` oraz `HabitCompletionBonusService` rozliczają
tygodnie według dat rozpoczęcia/zakończenia i historii progów. Nie znają jeszcze
okresów wstrzymania. Również zwykła edycja konfiguracji może uruchamiać rozliczenie.
Dlatego nie włączaj flagi w środowisku użytkowników przed etapem 2. Samo pomijanie
aktualnie wstrzymanych nawyków w jobie nie wystarczyłoby: błędne rozliczenie
mogłoby nastąpić po ich wznowieniu. Etap 1 nie zmienia algorytmów nagród ani
regularności i nie wdraża nowej semantyki historycznych korekt wykonań.

Do ręcznych testów na izolowanych danych uruchom backend z argumentem
`--app.habits.waiting-room-enabled=true`. Testy statusów włączają tę właściwość
wyłącznie we własnym kontekście testowym.

## API

Wymagana jest sesja użytkownika, a przy zapisie także dotychczasowy token CSRF.
Identyfikatory w przykładach zastąp identyfikatorami własnych nawyków.

```http
POST /api/habits
Content-Type: application/json

{"name":"Trening","targetDays":3,"rewardPoints":2}
```

Brak `activityStatus` lub `null` oznacza `ACTIVE`. Opcjonalnie:

```http
POST /api/habits
Content-Type: application/json

{"name":"Nauka pływania","targetDays":2,"activityStatus":"PLANNED"}
```

Tworzenie od razu `PAUSED` zwraca `400`. Każde poprawne utworzenie zapisuje jeden
otwarty okres historii w tej samej transakcji co nawyk i jego konfiguracja.

```http
PATCH /api/habits/123/status
Content-Type: application/json

{"status":"PAUSED"}
```

`200` zwraca aktualny obiekt nawyku wraz z `activityStatus`. Dozwolone przejścia:
`PLANNED → ACTIVE`, `ACTIVE → PAUSED`, `PAUSED → ACTIVE`. Powtórzenie bieżącego
statusu niczego nie dopisuje. Niedozwolone przejście daje `409`, pusty/nieznany
status `400`, a nieistniejący lub cudzy nawyk `404`.
Zwykłe endpointy PUT edycji i `/configuration` odrzucają `activityStatus` (`400`);
status można zmienić wyłącznie dedykowanym endpointem.

```http
GET /api/habits/123/status-history
```

Odpowiedź `200` (chronologicznie, przy jednakowych czasach według kolejności zapisu):

```json
[
  {"status":"ACTIVE","startedAt":"2026-10-30T10:00:00Z","endedAt":"2026-10-30T12:00:00Z"},
  {"status":"PAUSED","startedAt":"2026-10-30T12:00:00Z","endedAt":null}
]
```

Daty ustala wyłącznie serwer. Historia nie ma endpointów edycji ani usuwania.
Nowe wykonania dla `PLANNED` i `PAUSED` są blokowane (`409`). Istniejące wykonania
oraz dotychczasowa obsługa ich cofania pozostają zachowane. Szczegółowe reguły
korekt historycznych z uwzględnieniem statusu w dniu wykonania należą do etapu 2.

## Integralność i migracja

- Migracja `V45` ustawia wszystkie stare nawyki jako `ACTIVE` i zapisuje ich
  początkowy okres od chwili migracji. `created_on` jest datą bez godziny,
  więc nie służy do odtwarzania pozornego momentu utworzenia.
- Historia przed migracją jest nieznana, a nie wstrzymana. Etap 2 musi zachować
  wcześniejszą semantykę takich dni.
- Przedziały to `[startedAt, endedAt)`, zapisane jako `Instant` (UTC) z precyzją
  mikrosekund. Granica kończąca poprzedni okres jest początkiem kolejnego.
  Przy tej samej chwili mogą istnieć puste okresy; kolejność zachowuje `id`.
  Cofnięcie zegara nie może przesunąć granicy przed początek bieżącego okresu.
- Blokada `findForUpdate` serializuje zmiany statusu i wykonań tego samego nawyku.
  Aktualizacja statusu, zamknięcie okresu i utworzenie następnego są atomowe.
- Unikalność `(habit_id, open_slot)` z `open_slot=1` dla otwartego okresu
  zabezpiecza bazę przed dwoma otwartymi okresami. Zamknięte okresy mają `NULL`.
  Serwis utrzymuje dokładnie jeden otwarty okres i sprawdza zgodność jego statusu.
  Bezpośredni zapis SQL omijający serwis nie jest wspieranym interfejsem.
- Usunięcie nawyku usuwa historię przez FK `ON DELETE CASCADE`. Zmiana statusu
  nie zmienia wykonań, punktów, premii, progów ani powiązań z celami.

W etapie 2 do obliczeń posłużą `HabitStatusPeriod`, uporządkowana historia,
bieżący `activityStatus` i serwerowe granice UTC. Należy uwzględnić wszystkie
okresy, także wcześniejsze pauzy nawyku, który obecnie znów jest aktywny.
