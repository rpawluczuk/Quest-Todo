# Quest Todo — backend

Java 21, Spring Boot 4.1.1 i Maven Wrapper. Na tym etapie backend udostępnia
endpoint kontrolny oraz pobieranie i dodawanie zadań w pamięci. Nie łączy się
jeszcze z bazą; restart backendu przywraca trzy przykładowe zadania.

## Uruchomienie (PowerShell)

W folderze `backend`:

```powershell
$env:JAVA_HOME = 'C:\Program Files\Eclipse Adoptium\jdk-21.0.5.11-hotspot'
.\mvnw.cmd spring-boot:run
```

Powyższa ścieżka odpowiada obecnie zainstalowanej Javie 21 na komputerze autora.
Na innym komputerze podaj katalog własnego JDK 21. Ustawienie dotyczy tylko
bieżącego terminala. Jest potrzebne, jeśli `JAVA_HOME` wskazuje starszą Javę;
wersję używaną przez Maven sprawdzisz poleceniem `.\mvnw.cmd -v`.

Pierwsze uruchomienie wymaga internetu: wrapper pobiera Maven i zależności.
Java 21 musi być dostępna przez `JAVA_HOME` lub `PATH`.

Otwórz http://localhost:8080/api/health — oczekiwana odpowiedź:

```json
{"status":"UP"}
```

Zatrzymanie serwera: `Ctrl+C`. Frontend uruchamiamy osobno w `frontend` przez
`npm run dev`. Frontend pobiera zadania z `/api/tasks`; serwer deweloperski Vite
przekazuje żądania `/api` do `http://localhost:8080`. Po zmianie konfiguracji
Vite uruchom go ponownie. To proxy dotyczy pracy przez `npm run dev`;
wdrożenie produkcyjne będzie wymagało osobnej konfiguracji kierowania `/api`.

Dodawanie zapisuje zadanie na backendzie. Edycja, wykonanie, przenoszenie zadań
i zakupy nadal działają lokalnie w React. Odświeżenie strony zachowuje dodane
zadania, ale przywraca ich stan z serwera i zeruje zakupy.
Przy wyłączonym backendzie frontend pokazuje komunikat błędu zamiast listy.

## Pobieranie zadań

Otwórz http://localhost:8080/api/tasks. `GET /api/tasks` zwraca tablicę trzech
przykładowych zadań. Każde zawiera pola `id`, `title`, `points`, `completed`
i `inFocus`, zgodne z nazwami pól frontendu. Zadania są przechowywane w pamięci
w `TaskService`.

`POST /api/tasks` przyjmuje np. `{"title":"Trening","points":15}` i zwraca
HTTP 201 oraz nowe zadanie z ID nadanym przez serwer. Nowe zadanie ma
`completed: false` i `inFocus: false`. Nazwa jest przycinana; pusta nazwa
lub punkty inne niż liczba całkowita od 1 do 2147483647 powodują HTTP 400.

Po zmianie kodu zatrzymaj i uruchom backend ponownie.

## Testy i budowanie

```powershell
.\mvnw.cmd verify
```

Ta komenda uruchamia testy i tworzy wykonywalny plik JAR w `target/`.
Na Linux/macOS użyj `./mvnw` zamiast `.\mvnw.cmd`.

## Pliki

- `pom.xml` — zależności oraz konfiguracja budowania Maven.
- `mvnw`, `mvnw.cmd`, `.mvn/` — wrapper, dzięki któremu nie trzeba instalować Maven globalnie.
- `src/main/java/pl/questtodo/QuestTodoApplication.java` — punkt wejścia aplikacji.
- `src/main/java/pl/questtodo/health/HealthController.java` — obsługa `GET /api/health`.
- `src/main/java/pl/questtodo/task/` — rekord `Task`, serwis z danymi i kontroler HTTP.
- `src/main/resources/application.properties` — konfiguracja aplikacji.
- `src/test/java/` — test uruchomienia kontekstu i odpowiedzi endpointu.
