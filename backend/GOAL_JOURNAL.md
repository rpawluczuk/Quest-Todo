# Dziennik celu — API (etap 1)

Wpisy są informacyjne: nie zmieniają punktów, statusu celu, kamieni milowych,
zadań ani nawyków. Frontend nie jest częścią tego etapu.

Wszystkie endpointy wymagają istniejącej sesji użytkownika. Żądania zmieniające
dane wymagają również tokenu CSRF z `GET /api/auth/csrf` (nagłówek wskazany
przez `headerName`). Logowanie opisuje [LOGIN.md](LOGIN.md).

## Przykładowe żądania

```http
POST /api/goals/1001/entries
Content-Type: application/json
X-CSRF-TOKEN: <token>

{"type":"SUCCESS","content":"Pierwszy raz wstałem bez bólu pleców."}
```

Odpowiedź `201 Created`: `id`, `type`, `content`, `createdAt`, `updatedAt`.
Daty są momentami UTC. Pominięty `type` oznacza `NOTE`; jawne `null` jest
niepoprawne. Dostępne typy: `NOTE`, `SUCCESS`, `DIFFICULTY`, `INSIGHT`.
Treść jest wymagana, ma limit 5000 znaków i jest obcinana z zewnętrznych białych
znaków; nowe linie wewnątrz tekstu pozostają zachowane.

```http
GET /api/goals/1001/entries?page=0&size=3
```

Odpowiedź `200 OK`:

```json
{"entries":[{"id":123,"type":"SUCCESS","content":"Pierwsza poprawa.","createdAt":"2026-10-30T18:30:00Z","updatedAt":"2026-10-30T18:30:00Z"}],"hasMore":false}
```

Numeracja stron zaczyna się od 0, domyślny rozmiar to 20, dopuszczalny zakres
rozmiaru to 1–100. Kolejność: `createdAt DESC, id DESC`. Strona pobiera tylko
potrzebne rekordy i sprawdza istnienie następnej strony, bez liczenia całej historii.
Edycja nie przesuwa wpisu według daty ostatniej modyfikacji. Przy równoczesnym
dodawaniu wpisów paginacja offsetowa nie stanowi historycznego snapshotu.

```http
PATCH /api/goals/1001/entries/123
Content-Type: application/json
X-CSRF-TOKEN: <token>

{"type":"INSIGHT"}
```

Można podać tylko `type`, tylko `content` lub oba pola. Pominięcie pola zachowuje
jego wartość; jawne `null` jest odrzucane. `{}` i zapis niezmienionych danych
(również po normalizacji białych znaków) nie aktualizują `updatedAt` ani rekordu.
Odpowiedź `200 OK` zawiera DTO wpisu. `createdAt` pozostaje niezmienne.
Właściciel, identyfikator celu i daty nie są polami zapisywalnymi przez API.

```http
DELETE /api/goals/1001/entries/123
X-CSRF-TOKEN: <token>
```

Odpowiedź `204 No Content`. Usuwanie celu usuwa dziennik przez klucz obcy
`ON DELETE CASCADE`; usuwanie pojedynczego wpisu nie zmienia celu.

## Własność i cel osiągnięty

- Cudzy/nieistniejący cel, cudzy wpis albo wpis z innego celu: `404`.
- Niepoprawna treść, rodzaj, jawne `null` lub parametry strony: `400`.
- Osiągnięty cel: odczyt działa, a POST/PATCH/DELETE zwracają `409` z istniejącym
  komunikatem o trybie tylko do odczytu. Wznowienie celu przywraca zapis.
- Zapisy blokują ten sam rekord celu co zmiana jego statusu, aby oba działania
  były serializowane w transakcji. Odczyt nie ładuje kolekcji pozostałych relacji.

Model: `GoalEntryEntity`, relacja Many-to-One do `GoalEntity`, enum jako tekst.
Migracja: `V47__create_goal_entries.sql`, indeks `(goal_id, created_at DESC, id DESC)`.
Testy: `GoalEntryControllerTests` i `GoalEntryMigrationTests`; środowisko testowe
korzysta z H2 w trybie PostgreSQL, co nie zastępuje testu na prawdziwym PostgreSQL.
