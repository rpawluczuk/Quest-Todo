# Quest Todo — frontend

React, TypeScript i Vite. Publikacja na Render: [instrukcja krok po kroku](RENDER.md).

## Lokalnie

```powershell
npm ci
npm run dev
```

W `.env.local` ustaw `DEV_API_TARGET=http://localhost:8080` dla lokalnego backendu
lub `DEV_API_TARGET=https://quest-todo-api.onrender.com` dla backendu na Render.
Po zmianie zrestartuj Vite. `.env.local` jest ignorowany przez Git.

W trybie developerskim żądania `/api` przechodzą przez proxy Vite.
`VITE_API_BASE_URL` jest używane tylko w zbudowanej aplikacji, nie podczas `npm run dev`.

## Build i sprawdzenie kodu

```powershell
npm run build
npm run lint
```

Wynik znajduje się w `dist`. Dla publicznego hostingu ustaw przed buildem
`VITE_API_BASE_URL` na adres backendu bez `/api`, a w backendzie skonfiguruj
`CORS_ALLOWED_ORIGINS` z adresem frontendu. Zmiana adresu API wymaga ponownego builda.
Bez `VITE_API_BASE_URL` build używa względnego `/api` i wymaga serwera z proxy pod tą ścieżką.

Zmienne `VITE_*` są publiczne — nie wpisuj do nich haseł, tokenów ani danych połączenia z bazą.
