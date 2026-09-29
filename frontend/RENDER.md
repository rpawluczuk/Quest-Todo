# Frontend na Render Static Site

Frontend w przeglądarce wysyła żądania bezpośrednio do API na Render przez HTTPS.
Backend korzysta z PostgreSQL w Neon.

## 1. Wyślij kod

Zacommituj zmiany frontendu oraz konfigurację CORS backendu i wykonaj push na gałąź
podłączoną do Render. Przykładowy commit: `feat: prepare frontend for Render hosting`.
Backend musi wdrożyć tę wersję, żeby odczytywać `CORS_ALLOWED_ORIGINS`.

## 2. Utwórz frontend

W Render wybierz **New → Static Site**, połącz GitHub i wybierz to samo repozytorium.

| Pole | Wartość |
| --- | --- |
| Name | np. `quest-todo-web` |
| Branch | gałąź z wysłanymi zmianami, np. `main` |
| Root Directory | `frontend` |
| Build Command | `npm ci && npm run build` |
| Publish Directory | `dist` |

W **Environment Variables** tej nowej usługi dodaj:

| Key | Value |
| --- | --- |
| `VITE_API_BASE_URL` | `https://quest-todo-api.onrender.com` |
| `SKIP_INSTALL_DEPS` | `true` |

`SKIP_INSTALL_DEPS` wyłącza automatyczną instalację zależności Render, ponieważ komenda
budowania wykonuje już `npm ci`. Jeśli Twój backend ma inny adres, wpisz jego rzeczywisty
URL bez `/api` i bez cudzysłowów. Nie dodawaj tutaj danych połączenia z bazą.

Kliknij **Create Static Site / Deploy Static Site**. Poczekaj na status **Live**.
Skopiuj adres przydzielony frontendowi — może zawierać dodatkową końcówkę w nazwie.

## 3. Skonfiguruj połączenie w backendzie

Otwórz w Render istniejącą usługę **backendu**. W **Environment** dodaj:

```text
CORS_ALLOWED_ORIGINS=https://RZECZYWISTY-ADRES-FRONTENDU.onrender.com
```

Wpisz dokładny adres frontendu z kroku 2: z `https://`, bez końcowego `/`, ścieżki
i cudzysłowów. Zapisz zmiany i wdróż ponownie backend. Kilka adresów można oddzielić
przecinkami, np. po dodaniu własnej domeny. Nie wpisuj `*`.
CORS nie zastępuje logowania: aplikacja nadal używa jednego wspólnego użytkownika i publicznego API.

Do ukończenia tego kroku strona może się otwierać, ale nie pobierać danych.
Po uzyskaniu statusu **Live** backendu odśwież frontend.

## 4. Sprawdź aplikację

Otwórz URL **frontendu**. Powinny pojawić się zadania, saldo i nagrody z Neon.
Dodawanie i edycję sprawdzaj na danych testowych — działasz teraz na zewnętrznej bazie.
Pierwsze żądanie po uśpieniu backendu może czekać około minuty; sam frontend nie jest usypiany.
Jeśli wyświetli się błąd podczas wybudzania, zaczekaj i odśwież stronę.

Aplikacja przełącza widoki bez zmiany ścieżki URL, więc nie wymaga reguł rewrite.
Nie dodawaj przekierowania `/api`: zapytania idą bezpośrednio na adres API.

## Dalszy rozwój lokalnie

Pozostaw w swoim `frontend/.env.local`:

```dotenv
DEV_API_TARGET=http://localhost:8080
```

Uruchamiaj lokalny backend z profilem `local` oraz `npm run dev`. Publiczny frontend
korzysta z adresu API ustawionego w panelu Render. Ustawienia lokalne nie przełączają
opublikowanej aplikacji, a dane lokalne i Neon pozostają osobne.

Root Directory `frontend` i `backend` ograniczają automatyczne wdrożenia do zmian
w odpowiednim katalogu. Zmiana kontraktu API może wymagać wdrożenia obu usług.
Po zmianie `VITE_API_BASE_URL` wykonaj nowy build frontendu.

## Rozwiązywanie problemów

- Błąd CORS: sprawdź dokładny adres w `CORS_ALLOWED_ORIGINS`, aktualność kodu backendu
  i czy po zapisaniu zmiennej zakończyło się jego nowe wdrożenie.
- Zapytania `/api` idą do domeny frontendu albo zwracają HTML: brakuje
  `VITE_API_BASE_URL` w konfiguracji builda. Ustaw go na Static Site i zbuduj ponownie frontend.
- `Failed to fetch`: sprawdź backend pod `/api/health` i prefiks `https://` w adresie API.
- Zapis nie działa mimo poprawnego odczytu: sprawdź żądanie `OPTIONS` w Network.
  Backend musi mieć nową konfigurację CORS obsługującą POST, PATCH i DELETE.
- `DEV_API_TARGET` obsługuje wyłącznie lokalny serwer Vite; nie ustawiaj go na Static Site.

## Dokumentacja

- Render Static Sites: https://render.com/docs/static-sites
- Root Directory: https://render.com/docs/monorepo-support
- Zmienne Vite: https://vite.dev/guide/env-and-mode
- CORS Spring MVC: https://docs.spring.io/spring-framework/reference/web/webmvc-cors.html
