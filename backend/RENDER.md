# Backend na Render Free + Neon

Backend działa na Render, PostgreSQL w Neon, a frontend na razie lokalnie przez Vite.
Repozytorium zawiera Dockerfile budujący aplikację i uruchamiający testy na H2.
Hasła bazy ustawiasz wyłącznie w panelu Render.

## 1. Wyślij zmiany do repozytorium

Zacommituj pliki wdrożenia i wyślij je na GitHub. Przykładowa nazwa commita:
`build: prepare backend for Render deployment`.

## 2. Przygotuj połączenie z Neon

W panelu Neon otwórz projekt i wybierz **Connect**, właściwą gałąź, bazę oraz rolę.
Zapisz host, nazwę bazy, użytkownika i hasło. Wybierz połączenie bez poolera
(wyłącz **Connection pooling**), aby ten sam adres obsługiwał też migracje Flyway.

Backend korzysta z JDBC, więc URL ma format:

```text
jdbc:postgresql://TWÓJ_HOST.neon.tech/NAZWA_BAZY?sslmode=require
```

Nie wklejaj tu pełnego adresu `postgresql://użytkownik:hasło@...`.
Użytkownika i hasło wpiszesz osobno.

Wybranie istniejącej bazy Neon udostępni jej dane backendowi na Render.
Nie kopiuje danych z lokalnego Dockera. Flyway przy starcie zastosuje brakujące migracje;
nie zmieniaj już wykonanych migracji i nie uruchamiaj ponownie importu bazy tylko po to,
żeby wdrożyć backend.

Obecne API nie ma logowania i korzysta ze wspólnego użytkownika. Publiczny adres pozwala
odczytywać i zmieniać dane. Do publicznego demo użyj osobnej bazy z danymi przykładowymi;
prywatne dane wymagają dodania uwierzytelniania.

## 3. Utwórz usługę Render

Zaloguj się na https://dashboard.render.com i wybierz **New → Web Service**.
Połącz GitHub i wybierz repozytorium Quest-Todo.

| Pole | Wartość |
| --- | --- |
| Name | np. `quest-todo-api` (adres zależy od dostępności nazwy) |
| Region | Frankfurt, blisko obecnej bazy Neon w AWS eu-central-1 |
| Branch | gałąź, na którą wysłano zmiany, np. `main` |
| Root Directory | `backend` |
| Language / Runtime | `Docker` |
| Dockerfile Path | `./Dockerfile` |
| Docker Build Context Directory (jeśli widoczne) | `.` |
| Instance Type | **Free** |
| Docker Command | pozostaw puste — start definiuje Dockerfile |
| Health Check Path (Advanced) | `/api/health` |

Ścieżki Dockera są względne wobec Root Directory. Nie wpisuj drugi raz `backend/`.
Render buduje obraz z repozytorium; nie musisz publikować obrazu w Docker Hub.

W **Environment Variables** dodaj:

| Klucz | Wartość |
| --- | --- |
| `DB_URL` | adres JDBC z kroku 2 |
| `DB_USER` | użytkownik z Neon |
| `DB_PASSWORD` | hasło z Neon |

Nie otaczaj wartości cudzysłowami. Nie zapisuj hasła w repozytorium ani we frontendzie.
Render dostarcza zmienną `PORT`; backend ją odczytuje. Lokalnie nadal używa portu 8080.

Kliknij **Create Web Service / Deploy Web Service** i obserwuj logi.
Pierwszy build pobierze Javę i zależności Mavena, wykona testy, a następnie uruchomi aplikację.
Gotowa usługa powinna uzyskać status **Live**.

## 4. Sprawdź API

Skopiuj rzeczywisty adres usługi z panelu Render. Otwórz:

```text
https://TWÓJ-SERWIS.onrender.com/api/health
```

Oczekiwana odpowiedź: `{"status":"UP"}`.
Sprawdź też `/api/tasks` i `/api/rewards`, aby potwierdzić odczyt bazy.
Sam health check potwierdza działanie HTTP, nie wykonuje zapytania do bazy.

## 5. Podłącz lokalny frontend

W katalogu `frontend` skopiuj `.env.example` jako `.env.local` i ustaw adres usługi:

```dotenv
DEV_API_TARGET=https://TWÓJ-SERWIS.onrender.com
```

Adres ma zaczynać się od `https://` i nie zawierać końcówki `/api`.
Plik `.env.local` jest ignorowany przez Git. Zatrzymaj dotychczasowe Vite przez Ctrl+C
i w katalogu `frontend` uruchom:

```powershell
npm run dev
```

Uruchamiaj samo zadanie **Quest Todo: frontend** — zadania „uruchom wszystko” startują
także lokalny backend. Przeglądarka wysyła `/api` do lokalnego Vite, a Vite do Render;
ten układ nie wymaga dodawania CORS w backendzie.

Usuń `DEV_API_TARGET` z `.env.local` i zrestartuj Vite, aby wrócić do `localhost:8080`.
Ta konfiguracja dotyczy serwera deweloperskiego. Publiczny frontend na Render Static Site
korzysta z `VITE_API_BASE_URL` i `CORS_ALLOWED_ORIGINS` — zobacz
[instrukcję publikacji frontendu](../frontend/RENDER.md).

## Typowe problemy

- Pierwsze żądanie po 15 minutach bez ruchu może czekać około minuty na wybudzenie.
  Zaczekaj na odpowiedź `/api/health`, a następnie odśwież frontend.
- `password authentication failed`: sprawdź `DB_USER` i `DB_PASSWORD`.
- Błąd połączenia z bazą: sprawdź host, nazwę bazy, prefiks `jdbc:postgresql://`
  i parametr `sslmode=require` w `DB_URL`.
- `Flyway validation failed`: sprawdź migracje w logach; nie usuwaj historii Flyway.
- `OutOfMemoryError` / kod 137: sprawdź pamięć w panelu; darmowa instancja może okazać
  się zbyt mała. Dockerfile ogranicza stertę JVM do 60% dostępnej pamięci.
- `ECONNREFUSED localhost:8080` w Vite: sprawdź `.env.local` i zrestartuj Vite.
- Błąd na samym `/` jest spodziewany: backend udostępnia API, nie stronę frontendu.

## Źródła

- Docker na Render: https://render.com/docs/docker
- Root Directory i ścieżki w monorepo: https://render.com/docs/monorepo-support
- Port i tworzenie usługi: https://render.com/docs/web-services
- Limity Free: https://render.com/docs/free
- Zmienne środowiskowe w konfiguracji Vite: https://vite.dev/config/
