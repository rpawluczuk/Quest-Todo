# Poczekalnia nawyków — etapy 1–4

## Udostępnienie i kompatybilność

`Habit.activityStatus` przechowuje `ACTIVE`, `PLANNED` lub `PAUSED`.
Dotychczasowe pole odpowiedzi `status` (`ACTIVE`, `UPCOMING`, `FINISHED`) nadal
opisuje wynik istniejących zasad kalendarza i zakończenia na wybrany dzień.
Nie zastępuj jednego pola drugim. Frontend rozdziela te dwa znaczenia statusu.

**Od etapu 4 flaga `app.habits.waiting-room-enabled` jest domyślnie włączona.**
Można ją wyłączyć przez `HABIT_WAITING_ROOM_ENABLED=false` lub właściwość Springa.
Nowe nawyki `ACTIVE`, odczyt historii i idempotentne ustawienie bieżącego statusu
działają także z wyłączoną flagą. Utworzenie `PLANNED` oraz rzeczywista zmiana
statusu zwracają wtedy `503` z komunikatem biznesowym.

Etap 2 uwzględnia okresy statusów w wykonaniach, nagrodach tygodniowych,
regularności i rozliczeniach premii. Etap 4 udostępnia wstrzymywanie i wznawianie
istniejących nawyków. Zmiana jest widoczna dopiero po potwierdzeniu zapisu,
bez automatycznej zmiany zakładki. `PLANNED` nie ma jeszcze akcji rozpoczęcia
ani wyboru w formularzu tworzenia (zakres etapu 5).

Do ręcznych testów na izolowanych danych uruchom backend z argumentem
`--app.habits.waiting-room-enabled=true`. Test blokady konfiguracji sprawdza
również jawne wyłączenie tej właściwości.

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
Nowe wykonanie dzisiejsze wymaga `ACTIVE` w chwili zapisu, pod blokadą nawyku.
Status zmieniony w trakcie dnia jest więc respektowany natychmiast. Historyczna
data może być poprawiana, jeśli nawyk był aktywny przez choć część tego dnia
w strefie Europe/Warsaw. Sam status `ACTIVE` dzisiaj nie pozwala uzupełniać
całych dni spędzonych w `PAUSED` lub `PLANNED`. Istniejące ograniczenia dat
rozpoczęcia, końca i limitu wykonań nadal obowiązują.

Cofnięcie istniejącego wykonania (również w oknie cofnięcia nagrody) wymaga
aktywności w jego dniu. Można zatem poprawiać wcześniejsze aktywne dni podczas
obecnej pauzy. Ponowienie PUT dla już zapisanego wykonania jest bez zmian.
Niedozwolona korekta zwraca `409`. Klient nie ustala kwalifikacji dnia/tygodnia.

## Integralność i migracja

- Migracja `V45` ustawia wszystkie stare nawyki jako `ACTIVE` i zapisuje ich
  początkowy okres od chwili migracji. `created_on` jest datą bez godziny,
  więc nie służy do odtwarzania pozornego momentu utworzenia.
- Początkowy okres `ACTIVE` oznacza zachowanie aktywnej interpretacji wcześniejszych
  dni, także przed migracją. Brak historii w starym rekordzie również zachowuje
  wcześniejszą semantykę. Pierwszy okres `PLANNED` nie tworzy wcześniejszej aktywności.
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

## Nagrody i regularność (etap 2)

`HabitActivityTimeline` jest wspólną interpretacją historii i granic dni/tygodni.
Lokalny dzień jest przedziałem od północy do następnej północy w Europe/Warsaw,
co uwzględnia dni 23- i 25-godzinne. Okresy statusów pozostają przedziałami UTC.

- Nagroda tygodniowa wymaga pełnego dotychczasowego progu, także w tygodniu
  częściowo aktywnym. Nie ma proporcjonalnego obniżania progu z powodu pauzy.
  Liczą się wykonania z dni, w których nawyk rzeczywiście był aktywny.
- Zmiana statusu nie przyznaje ani nie odbiera punktów. Wznowienie nie odtwarza
  nagród. Istniejąca unikalność nagrody i blokada rodzica chronią przed duplikatami.
- Zwykłe cofnięcie wykonania nadal nie odbiera już zdobytej nagrody tygodniowej.
  Jawne cofnięcie nagrody w dotychczasowym oknie czasowym działa jak wcześniej.
- Dla regularności nawet krótki, dodatni czas `PAUSED`/`PLANNED` w ocenianym
  przedziale czyni go neutralnym, również gdy tygodniowy próg został osiągnięty.
  Tydzień neutralny nie zwiększa licznika ani mianownika regularności.
- Przedział oceny nadal jest przycięty do dat rozpoczęcia i zakończenia nawyku.
  Przerwa poza tym przedziałem nie unieważnia tygodnia. Dotychczasowe proporcje
  dla niepełnych tygodni wynikających z samych dat obowiązywania są zachowane.
- Bieżący niezakończony okres nie jest oceniany. Przy zerze ocenionych tygodni
  procent to `null`; nawet próg 1% nie daje wtedy premii.
  Migracja `V46` pozwala utrwalić rozliczenie `0/0` wyłącznie bez aktywnej premii.
- Premie datowe rozliczają się po końcu okresu według nowej regularności, także
  w tle dla nawyku obecnie wstrzymanego. Liczy się cała historia, nie bieżący status.
- Premie za liczbę wykonań i ich blokady pozostają bez zmian. Historyczne korekty
  mogą cofnąć/przywrócić premię tak jak wcześniej; sama pauza nigdy tego nie robi.
  Licznik całkowity i istniejące wykonania nie są usuwane ani zerowane.

Walidacja aktywności, zapis wykonania i naliczenie nagrody odbywają się pod tą
samą blokadą nawyku co przejścia statusów. Dwa równoczesne żądania wykonania
i wstrzymania zostają zserializowane: zapis po wstrzymaniu jest odrzucony,
chyba że jest tylko ponowieniem już zapisanego wykonania.

## Tworzenie i rozpoczynanie zaplanowanych nawyków (etap 5)

Wspólny formularz tworzenia pozwala wybrać „Rozpocznij teraz” (`ACTIVE`) lub
„Dodaj do Poczekalni” (`PLANNED`). Przycisk w nagłówku domyślnie wybiera status
odpowiadający bieżącej zakładce. Utworzenie nie przełącza zakładki.
POST `/api/habits` przesyła `activityStatus`, zgodnie z istniejącym kontraktem.

Zaplanowany nawyk można edytować tym samym formularzem konfiguracji, bez zmiany
statusu. Akcja „Rozpocznij” wywołuje PATCH `/api/habits/{id}/status` z
`{"status":"ACTIVE"}`; po potwierdzeniu ten sam rekord przechodzi do Aktywnych.
Backend ustala moment rozpoczęcia i zachowuje ustawienia oraz przypisane cele.
Frontend nie nalicza punktów ani nie tworzy okresów historii.

## Integracja z celami (etap 6)

`HabitProvider` udostępnia jeden cache nawyków na sesję, z osobnymi licznikami
dla przeglądanych dni. Cele i główna lista korzystają z tego samego zapisu
statusu i blokady równoczesnych żądań. Starsze odczyty nie nadpisują zapisanych
zmian. Zmiana statusu aktualizuje cache bez pobierania wszystkich celów ani
historii statusów. Przypinanie i odpinanie aktualizuje również dane relacji
w cache, aby późniejsza edycja nie przywracała usuniętych powiązań.

W celu aktywne nawyki poprzedzają grupę „Poczekalnia”. Zaplanowane nie pokazują
tygodniowego postępu; wstrzymane pokazują status i zachowany licznik wykonań.
Licznik zakładki nadal obejmuje wszystkie przypisane nawyki.
Osiągnięty cel pokazuje aktualne dane nawyków w trybie tylko do odczytu,
bez historycznych snapshotów i bez zmiany statusów samych nawyków.
