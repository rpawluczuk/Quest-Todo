# Podzadania — API

Wszystkie operacje wymagają istniejącej sesji użytkownika. Dla POST, PUT, PATCH i DELETE
użyj również tokenu CSRF, tak jak w pozostałych endpointach aplikacji.
Identyfikatory w przykładach zastąp identyfikatorami własnego zadania i podzadania.

```http
POST /api/tasks/1/subtasks
Content-Type: application/json

{"title":"Dodać endpoint resetowania hasła"}
```

Odpowiedź `201 Created`:

```json
{"id":123,"title":"Dodać endpoint resetowania hasła","completed":false,"position":0}
```

```http
GET /api/tasks/1/subtasks
```

Odpowiedź `200 OK`: tablica DTO posortowana po `position`, a następnie `id`.
Zadanie bez podzadań zwraca `[]`.

```http
PATCH /api/tasks/1/subtasks/123
Content-Type: application/json

{"title":"Przygotować endpoint resetowania hasła"}
```

```http
PATCH /api/tasks/1/subtasks/123
Content-Type: application/json

{"completed":true}
```

PATCH zwraca `200 OK` i aktualne DTO. Można przesłać oba pola jednocześnie.
Pominięte pole zachowuje wartość, jawne `null` daje `400`. Pusty obiekt jest
operacją bez zmian. Cofnięcie ukończenia: `{"completed":false}`.
Tytuł jest wymagany, nie może być pusty ani zawierać samych białych znaków;
limit wynosi 120 znaków (jak dla kamieni milowych). Brzegowe białe znaki są usuwane.

```http
DELETE /api/tasks/1/subtasks/123
```

Odpowiedź `204 No Content`. Nieistniejące lub cudze zadanie/podzadanie oraz
podzadanie spoza zadania wskazanego w URL zwracają `404`.

## Integralność i kolejność

`PUT /api/tasks/{taskId}/subtasks/order` przyjmuje `{"subtaskIds":[123,124]}`
i zwraca `200 OK` z pełną listą DTO w nowej kolejności. Lista musi zawierać
dokładnie wszystkie aktualne podzadania rodzica, bez powtórzeń. Niezgodność
(w tym dodanie/usunięcie elementu w innej sesji) zwraca `409`; frontend odświeża listę.
Brak listy lub nieprawidłowy identyfikator zwraca `400`, cudzy/nieistniejący rodzic `404`.
Zapis pod blokadą rodzica jest atomowy i nadaje pozycje od `0`. Powtórzenie
tej samej kolejności nie zmienia danych. Równoczesne zmiany samej kolejności
są serializowane — obowiązuje ostatni zapis, bez wersjonowania listy.

- Migracja `V44` tworzy tabelę `subtasks` i indeks `(task_id, position, id)`.
- Usunięcie zadania usuwa podzadania przez `ON DELETE CASCADE`.
- Zapis blokuje rekord zadania przez istniejący `findForUpdate`. Nowa pozycja
  to `max(position) + 1`, a dla pustej listy `0`. Usuwanie nie renumeruje listy.
- Podzadania nie przyznają punktów ani nie zmieniają statusu rodzica.
  Zmiana statusu rodzica nie zmienia podzadań.
- Relacja JPA jest jednokierunkowa Many-to-One, bez kaskady do rodzica.
  Lista zadań nie pobiera dodatkowych kolekcji.
- Frontend umożliwia zmianę kolejności uchwytem, dotykiem i klawiaturą.
  Błąd zapisu przywraca poprzednią kolejność. Podzadania nie mają zagnieżdżeń.
