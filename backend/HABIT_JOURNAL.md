# Dziennik nawyku — backend

API wymaga zalogowanego właściciela nawyku. Kontrakt odpowiada Dziennikowi celu.

```http
POST /api/habits/123/entries
Content-Type: application/json

{"type":"SUCCESS","content":"Pierwszy miesiąc regularnych ćwiczeń."}
```

Odpowiedź `201 Created`: `id`, `type`, `content`, `createdAt`, `updatedAt`.
Typy: `NOTE` (domyślny), `SUCCESS`, `DIFFICULTY`, `INSIGHT`.
Treść: 1–5000 znaków, nie może być samymi białymi znakami. Zewnętrzne białe
znaki są usuwane, podziały akapitów pozostają. Limit dotyczy treści żądania.

```http
GET /api/habits/123/entries?page=0&size=3
```

Odpowiedź `200 OK`: `{"entries":[...],"hasMore":false,"totalElements":1}`.
Sortowanie: `createdAt DESC, id DESC`. Domyślnie `page=0`, `size=20`, maksymalnie
100 wpisów na stronę. Edycja nie zmienia kolejności. Przy zmianie rozmiaru
strony z 3 na 10 należy rozpocząć pobieranie od `page=0` i zastąpić podgląd;
`page=1&size=10` pomija pierwszych 10 wpisów.

```http
PATCH /api/habits/123/entries/456
Content-Type: application/json

{"type":"INSIGHT","content":"Ćwiczenia rano sprawdzają się najlepiej."}
```

Odpowiedź `200 OK` zawiera wpis. Można wysłać tylko jedno pole lub `{}`.
Jawne `null` jest błędem. Brak rzeczywistej zmiany nie aktualizuje `updatedAt`.
Daty są nadawane przez serwer jako momenty UTC z precyzją mikrosekund.
Pola identyfikatora, właściciela, nawyku i dat z body są ignorowane, tak jak
w Dzienniku celu; nie pozwalają nadpisać danych.

```http
DELETE /api/habits/123/entries/456
```

Odpowiedź `204 No Content`.

Niepoprawne dane lub paginacja: `400`. Nieistniejący/cudzy nawyk albo wpis
nienależący do wskazanego nawyku: `404`. Próba modyfikacji dziennika
zakończonego nawyku: `409` z opisem w `ProblemDetail`.

`ACTIVE`, `PAUSED` i `PLANNED` pozwalają na CRUD. Zakończenie jest niezależne
od statusu aktywności: ręczne `endedOn`, przekroczona data końcowa lub osiągnięty
limit wykonań do dzisiaj, zgodnie z obliczaniem `FINISHED` w `HabitService`.
Obowiązuje kalendarz Europe/Warsaw. Nie ma endpointu cofającego ręczne zakończenie.
Przedłużenie konfiguracji automatycznie zakończonego nawyku odblokowuje dziennik.

Migracja `V48` dodaje `habit_entries` z kluczem obcym `ON DELETE CASCADE`,
ograniczeniami danych oraz indeksem `(habit_id, created_at DESC, id DESC)`.
Nie zmienia istniejących danych. Wpisy mają leniwą relację do nawyku;
lista nawyków nie pobiera dzienników. Modyfikacje blokują rekord rodzica,
używając istniejącego `findForUpdate`, odczyt ma transakcję `readOnly`.

Implementacja ponownie wykorzystuje `GoalEntryType` oraz walidację DTO
Dziennika celu przez dziedziczenie klas żądań. Encje i tabele są niezależne.
CRUD nie uruchamia rozliczeń punktów, premii ani wykonań. Powiązania z celami
nie kopiują wpisów, a usunięcie celu nie usuwa dziennika nawyku.

Testy: `HabitEntryControllerTests` i `HabitEntryMigrationTests`.
Test migracji używa H2 w trybie PostgreSQL i sprawdza aktualizację bazy V47,
zachowanie istniejących danych, ograniczenia i kaskadowe usuwanie.

```shell
./mvnw test
```
