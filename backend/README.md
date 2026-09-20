# Quest Todo — backend

Java 21, Spring Boot, PostgreSQL, Spring Data JPA i Flyway.

## Uruchomienie lokalne

1. Uruchom Docker Desktop.
2. W głównym katalogu repozytorium wykonaj:

```powershell
docker compose up -d --wait
```

3. W katalogu `backend` uruchom:

```powershell
.\mvnw.cmd spring-boot:run
```

Maven wymaga JDK 21. Sprawdź `.\mvnw.cmd -v`. Jeśli `JAVA_HOME` wskazuje starszą
Javę, ustaw w PowerShell `$env:JAVA_HOME = 'C:\Program Files\Eclipse Adoptium\jdk-21.0.5.11-hotspot'`
(lub ścieżkę swojego JDK). W CMD użyj `set "JAVA_HOME=C:\ścieżka\do\jdk-21"`.

Frontend uruchom osobno w `frontend` przez `npm run dev`. Proxy Vite przekazuje
`/api` do localhost:8080. Konfiguracja proxy dotyczy serwera deweloperskiego.

## Baza danych

Compose udostępnia PostgreSQL 17 tylko na `localhost:5432`:

- baza: `quest_todo`
- użytkownik: `quest_todo`
- hasło lokalne: `quest_todo_local`

To dane do lokalnej nauki. Backend pozwala je zastąpić przez `DB_URL`, `DB_USER`
i `DB_PASSWORD`. Wolumen `quest-todo_postgres_data` przechowuje dane po restarcie
backendu i kontenera. `docker compose stop` zatrzymuje bazę; `docker compose up -d --wait`
uruchamia ją ponownie. Nie używaj `docker compose down -v`, jeśli chcesz zachować dane:
opcja `-v` usuwa wolumen.

Flyway uruchamia migracje z `src/main/resources/db/migration` i zapamiętuje wykonane
wersje w bazie. `V1__create_tasks.sql` tworzy tabelę i dodaje trzy przykładowe zadania
jednorazowo. Kolejne zmiany struktury dodawaj jako nowe migracje — nie edytuj wykonanych.
Hibernate sprawdza strukturę (`ddl-auto=validate`), ale jej nie zmienia.

Zadania zapisane wcześniej w pamięci starego backendu nie są automatycznie przenoszone.
Zakupy nagród nadal pozostają w React i resetują się po odświeżeniu strony.

## API

- `GET /api/health` — `{"status":"UP"}` (informacja o działaniu HTTP, nie test bazy).
- `GET /api/tasks` — zadania uporządkowane według ID.
- `POST /api/tasks` — `{"title":"Trening","points":15}`, odpowiedź 201 i nowe zadanie.
- `PATCH /api/tasks/{id}` — oba pola `title` i `points`, odpowiedź 200; wykonane zadanie daje 409.
- `PATCH /api/tasks/{id}/completion` — `{"completed":true}` lub `false`.
- `PATCH /api/tasks/{id}/focus` — `{"inFocus":true}` lub `false`.

Nazwa nie może być pusta; punkty muszą być całkowite, od 1 do 2147483647.
Błędne dane dają 400, nieistniejące zadanie — 404. Powtórzenie żądania zmiany
stanu nie przełącza wartości. Restart backendu nie usuwa zadań.

## Podział kodu

- `TaskController` — HTTP i walidacja żądań.
- `TaskService` — operacje w transakcjach i reguły edycji.
- `TaskRepository` — dostęp do tabeli przez JPA; zmiany blokują aktualizowany wiersz,
  aby równoległe żądania nie nadpisywały innych pól.
- `TaskEntity` — encja JPA mapowana na tabelę `tasks`.
- `Task` — rekord odpowiedzi API; format JSON frontendu pozostaje bez zmian.

## Testy

W folderze `backend`:

```powershell
.\mvnw.cmd verify
```

Testy korzystają z osobnej H2 w pamięci (tryb zgodności PostgreSQL) i tych samych
migracji Flyway. Nie wymagają Dockera i nie modyfikują lokalnego PostgreSQL.
H2 nie zastępuje sprawdzenia na prawdziwym PostgreSQL.

Ręcznie: dodaj zadanie, zmień nazwę, przenieś do Focus i wykonaj. Zatrzymaj backend
przez Ctrl+C, uruchom ponownie i odśwież frontend. Zadanie i jego stan powinny pozostać.
Na Linux/macOS użyj `./mvnw` zamiast `.\mvnw.cmd`.