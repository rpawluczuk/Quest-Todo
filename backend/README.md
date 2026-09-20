# Quest Todo — backend

Java 21, Spring Boot 4.1.1 i Maven Wrapper. Na tym etapie backend udostępnia
jedynie endpoint kontrolny; nie zapisuje jeszcze zadań ani nie łączy się z bazą.

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
- `src/main/resources/application.properties` — konfiguracja aplikacji.
- `src/test/java/` — test uruchomienia kontekstu i odpowiedzi endpointu.
