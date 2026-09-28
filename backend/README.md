# Quest Todo — backend

Java 21, Spring Boot, PostgreSQL, Spring Data JPA i Flyway.

Wdrożenie backendu na Render Free z bazą Neon: [instrukcja krok po kroku](RENDER.md).

## Uruchomienie lokalne

1. Uruchom Docker Desktop.
2. W głównym katalogu repozytorium wykonaj:

```powershell
docker compose up -d --wait
```

3. W katalogu `backend` uruchom:

```powershell
.\mvnw.cmd spring-boot:run "-Dspring-boot.run.profiles=local"
```

Maven wymaga JDK 21. Sprawdź `.\mvnw.cmd -v`. Jeśli `JAVA_HOME` wskazuje starszą
Javę, ustaw w PowerShell `$env:JAVA_HOME = 'C:\Program Files\Eclipse Adoptium\jdk-21.0.5.11-hotspot'`
(lub ścieżkę swojego JDK). W CMD użyj `set "JAVA_HOME=C:\ścieżka\do\jdk-21"`.

Profil `local` wybiera bazę PostgreSQL z Compose i port 8080, także jeśli zwykłe
zmienne `DB_URL`, `DB_USER` i `DB_PASSWORD` wskazują Neon. Nie włączaj tego profilu na Render.

Przed lokalnym testem ustaw w `frontend/.env.local`:

```dotenv
DEV_API_TARGET=http://localhost:8080
```

Frontend uruchom osobno w `frontend` przez `npm run dev`. Po zmianie `.env.local`
zrestartuj Vite. Proxy przekazuje `/api` do lokalnego backendu.
Konfiguracja proxy dotyczy serwera deweloperskiego.

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
Migracja V3 tworzy domyślnego użytkownika `Gracz` (ID 1), przypisuje mu istniejące
zadania i ustawia saldo na sumę punktów ukończonych zadań. Saldo i nowe zakupy
są przechowywane w bazie. Dawnych zakupów z pamięci React nie można odtworzyć.
Na tym etapie aplikacja korzysta z jednego użytkownika, bez logowania.

Ukończenie zadania dodaje punkty tylko przy zmianie statusu. Cofnięcie ukończenia
odejmuje je (saldo może stać się ujemne po wcześniejszych zakupach). Usunięcie
zadania zachowuje zdobyte punkty. Zakup zapisuje nazwę i koszt nagrody z chwili zakupu;
sprawdzenie salda, odjęcie punktów i zapis zakupu odbywają się w jednej transakcji.
Blokada rekordu użytkownika chroni saldo przy równoczesnych operacjach.

## API

- `PATCH /api/rewards/{id}` — edytuje nazwę i koszt nagrody, np.
  `{"title":"Wyjście do kina","cost":100}`. Oba pola są wymagane, odpowiedź 200
  zawiera aktualną nagrodę. Walidacja jak przy tworzeniu; brak nagrody daje 404.
  Edycja nie zmienia salda ani wcześniejszych zakupów. Kolejny zakup używa nowej ceny.
  W widoku „Nagrody” wybierz „Edytuj”, następnie „Zapisz” lub „Anuluj”.

- `POST /api/rewards` — tworzy nagrodę, np. `{"title":"Wyjście do kina","cost":120}`;
  odpowiedź 201 zawiera `id`, `title` i `cost`. Nazwa nie może być pusta, a koszt
  musi być liczbą całkowitą od 1 do 2147483647. Błędne dane dają 400.
  Tworzenie nagrody nie zmienia salda; punkty odejmowane są dopiero przy zakupie.
  Formularz dodawania jest dostępny w widoku „Nagrody”.

- `GET /api/users/me` — domyślny użytkownik: `id`, `name`, `points`.
- `GET /api/rewards/purchases` — historia zakupów: `id`, `rewardId`, `title`, `cost`.
- `POST /api/rewards/{id}/purchases` — zakup, odpowiedź 201; brak punktów daje 409,
  brak nagrody 404. Każde żądanie oznacza osobny zakup.

- `GET /api/health` — `{"status":"UP"}` (informacja o działaniu HTTP, nie test bazy).
- `GET /api/tasks` — zadania uporządkowane według ID.
- `DELETE /api/tasks/{id}` — trwałe usunięcie zadania, odpowiedź 204 bez treści; brak ID daje 404.
- `GET /api/rewards` — nagrody z PostgreSQL, uporządkowane według ID; pola `id`, `title`, `cost`.
- `POST /api/tasks` — `{"title":"Trening","points":15}`, odpowiedź 201 i nowe zadanie.
- `PATCH /api/tasks/{id}` — oba pola `title` i `points`, odpowiedź 200; wykonane zadanie daje 409.
- `PATCH /api/tasks/{id}/completion` — `{"completed":true}` lub `false`.
- `PATCH /api/tasks/{id}/focus` — `{"inFocus":true}` lub `false`.

Nazwa nie może być pusta; punkty muszą być całkowite, od 1 do 2147483647.
Błędne dane dają 400, nieistniejące zadanie — 404. Powtórzenie żądania zmiany
stanu nie przełącza wartości. Restart backendu nie usuwa zadań.

## Podział kodu

Usuwanie działa również dla wykonanych zadań. Ponieważ saldo jest obliczane
z istniejących wykonanych zadań, usunięcie takiego zadania odejmuje jego punkty
i może spowodować ujemne saldo. Zakupy nie są przez to cofane.

Pakiet `reward` udostępnia odczyt nagród przez kontroler, serwis i repozytorium JPA.
Migracja `V2__create_rewards.sql` tworzy tabelę i jednorazowo dodaje trzy nagrody.
Frontend pobiera je przez `rewardApi.ts`. Kupowanie i saldo nadal są obsługiwane
lokalnie — ta zmiana nie zapisuje zakupów w bazie.

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

## Od lokalnego testu do Render

1. Uruchom lokalną bazę, backend z profilem `local` i frontend zgodnie z instrukcją wyżej.
2. W „Nagrody” zmień nazwę i koszt, zapisz i odśwież stronę. Sprawdź również „Anuluj”,
   pustą nazwę i niedodatni koszt. Historia wcześniejszych zakupów powinna pozostać bez zmian.
3. Po własnym sprawdzeniu zacommituj kod i wyślij go na gałąź podłączoną do Render.
   Przykładowy commit: `feat: add reward editing`.
4. Poczekaj na status **Live** nowego wdrożenia. Jeśli automatyczne wdrożenia są wyłączone,
   wybierz w Render **Manual Deploy → Deploy latest commit**.
5. Zmień `DEV_API_TARGET` w `frontend/.env.local` na adres swojego backendu Render
   (bez `/api`), a następnie zrestartuj Vite. Korzystasz wtedy z nowego kodu frontendu
   na komputerze oraz nowego backendu na Render i bazy Neon.

Plik `.env.local` jest ignorowany przez Git. Commit i push przenoszą kod, a nie dane:
nagrody zmienione lokalnie nie nadpiszą nagród w Neon. Edycja nagród nie wymaga nowej
migracji bazy. Hosting publicznego frontendu jest osobnym krokiem.
