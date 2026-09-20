# Quest Todo — backend

Java 21, Spring Boot 4.1.1 i Maven Wrapper. Na tym etapie backend udostępnia
endpoint kontrolny i listę przykładowych zadań w pamięci; nie zapisuje jeszcze
zmian ani nie łączy się z bazą.

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
`npm run dev`; nie jest jeszcze połączony z backendem.

## Pobieranie zadań

Otwórz http://localhost:8080/api/tasks. `GET /api/tasks` zwraca tablicę trzech
przykładowych zadań. Każde zawiera pola `id`, `title`, `points`, `completed`
i `inFocus`, zgodne z nazwami pól frontendu. Zadania są przechowywane w pamięci
w `TaskService`; endpoint na tym etapie obsługuje wyłącznie odczyt.

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
