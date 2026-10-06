# Logowanie — pierwsze uruchomienie i wdrożenie

Logowanie wykorzystuje login, hasło i sesję Spring Security. Migracja V8 dodaje
pola loginu oraz skrótu hasła do istniejących użytkowników. Nie tworzy nowego konta,
nie przelicza salda i nie przenosi danych. Pierwsze dane logowania przypisuje się
wyłącznie istniejącemu użytkownikowi ID 1. Pozostali użytkownicy tworzą konta przez
przycisk „Nie masz konta? Zarejestruj się” na ekranie logowania.

## Samodzielna rejestracja

Formularz wymaga loginu, hasła i powtórzenia hasła. Obowiązują te same wymagania
loginu i hasła co poniżej. Loginy są zapisywane małymi literami i muszą być unikalne.
Login jest też początkową nazwą wyświetlaną. Po rejestracji użytkownik loguje się
zwykłym formularzem. Nowe konto ma 0 punktów i puste zadania, nagrody oraz zakupy.
Rejestracja nie zmienia danych istniejących kont i nie wymaga nowej migracji bazy.

`POST /api/auth/register` przyjmuje JSON z polami `login` i `password` oraz wymaga
tokena CSRF. Zwraca 201 po utworzeniu konta, 400 dla nieprawidłowych danych lub 409
dla zajętego loginu. Nie loguje automatycznie. Rejestracja jest publiczna: każda osoba
znająca adres aplikacji może utworzyć konto. Ten etap nie dodaje odzyskiwania hasła,
weryfikacji e-mail ani ograniczania liczby prób.

## Zmiana hasła po zalogowaniu

W menu avatara wybierz „Zmień hasło”. Podaj obecne hasło, nowe hasło oraz jego
powtórzenie. Nowe hasło musi różnić się od obecnego i mieć minimum 8 znaków,
maksimum 72 bajty UTF-8. Hasła nie są przycinane ani normalizowane.

`POST /api/auth/password` wymaga zalogowania i CSRF; przyjmuje JSON z polami
`currentPassword`, `newPassword`, `confirmation`. Sukces zwraca 204, błędne dane
400 z komunikatem, brak sesji 401, brak CSRF 403. Zmieniane jest wyłącznie hasło
zalogowanego użytkownika. Nie ma migracji ani zmian zadań, salda i nagród.

Po zatwierdzeniu transakcji bieżąca sesja jest niszczona, a pozostałe sesje konta
w rejestrze Spring Security tracą ważność i otrzymują 401 przy kolejnym żądaniu.
Sesje innych użytkowników pozostają aktywne. Rejestr jest w pamięci jednej instancji,
tak jak dotychczasowe sesje aplikacji. Ta funkcja nie odzyskuje zapomnianego hasła.

## Pierwszy login i hasło

Przed pierwszym uruchomieniem ustaw w środowisku backendu:

| Zmienna | Wartość |
| --- | --- |
| `INITIAL_USER_LOGIN` | Wybrany login: 3–64 znaki, litery a–z, cyfry, kropka, podkreślenie lub myślnik; pierwszy znak musi być literą lub cyfrą. |
| `INITIAL_USER_PASSWORD` | Własne hasło: minimum 8 znaków, maksimum 72 bajty UTF-8. |

Login jest normalizowany do małych liter. Hasło jest zapisywane jako skrót BCrypt
z kosztem 12. Nie zapisuj hasła w repozytorium ani konfiguracji frontendu.

Inicjalizacja jest jednorazowa i blokuje wiersz konta na czas zapisu. Jeśli konto
ma już login, kolejne uruchomienia nie zmieniają loginu ani hasła, nawet gdy zmienisz
zmienne środowiskowe. Po udanym pierwszym logowaniu usuń obie zmienne ze środowiska.
Nie służą do resetowania hasła. Brak zmiennych nie tworzy domyślnego hasła ani
publicznego formularza przejmowania konta — konto bez danych logowania jest niedostępne.

Nieprawidłowa konfiguracja pierwszych danych logowania zatrzymuje start aplikacji;
popraw konfigurację i uruchom ponownie. Migracje mogły zostać już wtedy wykonane.

## Lokalnie: Vite i backend

Uruchamiaj backend z profilem `local`, z powyższymi zmiennymi ustawionymi lokalnie
przed pierwszym startem. Możesz podać hasło bez zapisywania go w historii PowerShell:

```powershell
$env:INITIAL_USER_LOGIN = Read-Host 'Login konta w lokalnej bazie'
$initialPassword = Read-Host 'Hasło konta w lokalnej bazie' -AsSecureString
$env:INITIAL_USER_PASSWORD = [System.Net.NetworkCredential]::new('', $initialPassword).Password
try {
    .\mvnw.cmd spring-boot:run "-Dspring-boot.run.profiles=local"
} finally {
    Remove-Item Env:INITIAL_USER_LOGIN, Env:INITIAL_USER_PASSWORD -ErrorAction SilentlyContinue
    $initialPassword.Dispose()
}
```

Powyższe wykonaj w katalogu `backend`. Profil `local` wskazuje wyłącznie lokalną
bazę Compose, wyłącza `Secure` dla HTTP i dopuszcza pochodzenie `localhost:5173`
oraz `127.0.0.1:5173`. Frontend uruchom przez `npm run dev`, z
`DEV_API_TARGET=http://localhost:8080`. Przy innym porcie Vite ustaw dokładne
pochodzenie w `CORS_ALLOWED_ORIGINS`. Używaj jednej nazwy hosta konsekwentnie.

## Render: zalecane wspólne pochodzenie strony i API

Repozytorium zawiera główny `Dockerfile`, który buduje React i umieszcza jego pliki
w backendzie. Strona i `/api` działają pod jednym adresem istniejącej usługi Render.
To pozwala używać sesji bez polegania na ciasteczkach stron trzecich między osobnymi
adresami `onrender.com`. Lokalnie nadal możesz rozwijać Vite i backend osobno.

Przed pushem uruchamiającym wdrożenie:

1. Wyłącz automatyczne wdrożenia na czas przygotowania i wykonaj świeżą kopię Neon.
2. W istniejącym Web Service zachowaj `DB_URL`, `DB_USER`, `DB_PASSWORD` oraz połączenie
   z tą samą bazą Neon. Nie ustawiaj profilu `local`.
3. Ustaw **Root Directory** na katalog główny repozytorium (puste pole),
   **Dockerfile Path** na `./Dockerfile`, a **Docker Build Context Directory** na `.`.
   Używany jest główny Dockerfile, nie `backend/Dockerfile`. Jeśli skonfigurowano
   filtry buildów, muszą uwzględniać także `frontend/**` i główny `Dockerfile`.
4. Ustaw `INITIAL_USER_LOGIN` i `INITIAL_USER_PASSWORD` w zmiennych środowiskowych
   backendu. `SESSION_COOKIE_SECURE=true` i `SESSION_COOKIE_SAME_SITE=lax` są domyślne.
   Frontend w tym obrazie używa względnego `/api`; `VITE_API_BASE_URL` jest pusty.
   Dla jednego pochodzenia `CORS_ALLOWED_ORIGINS` może być puste.
5. Wdróż nowy commit. Przez czas przełączenia instancji nie korzystaj z aplikacji.
   Nowy backend automatycznie wykona brakujące migracje, w tym V8 (i V7, jeżeli
   nie została wcześniej wdrożona). Przy V7 stary backend nie może dodawać nagród.
6. Po statusie Live otwórz główny adres Web Service, zaloguj się i sprawdź saldo,
   zadania, nagrody, zakupy, odświeżenie strony i wylogowanie.
7. Po udanym sprawdzeniu usuń zmienne `INITIAL_USER_*`. Zmiana konfiguracji może
   zrestartować backend i wymagać ponownego logowania. Zaktualizuj zakładkę aplikacji;
   osobny Static Site nie jest już potrzebny do tego wariantu.

Nie cofaj produkcji do wersji bez logowania: ponownie udostępniłaby prywatne API.
Wycofanie kodu nie cofa migracji bazy. Niniejsza implementacja nie zmienia ustawień
Render ani nie wdraża się automatycznie bez pusha/akcji skonfigurowanej w Render.

## Jeśli frontend musi pozostać osobno

`backend/Dockerfile` nadal buduje samo API. Dla osobnego frontendu ustaw dokładne
`CORS_ALLOWED_ORIGINS` i `VITE_API_BASE_URL`. Najlepiej użyć subdomen własnej wspólnej
domeny z HTTPS. Różne witryny wymagają `SESSION_COOKIE_SAME_SITE=none` i
`SESSION_COOKIE_SECURE=true`, ale przeglądarka nadal może blokować ciasteczka stron
trzecich. Same ustawienia CORS tego nie rozwiązują. Wspólny adres jest wariantem
domyślnym opisanym powyżej.

## Zachowanie sesji i API

- `GET /api/auth/csrf`: publiczny endpoint zwracający `headerName` i zamaskowany `token`.
- `POST /api/auth/login`: formularz `application/x-www-form-urlencoded` z polami
  `username` i `password` oraz nagłówkiem CSRF; sukces `204`, błędne dane `401`.
- `POST /api/auth/logout`: wymaga CSRF, usuwa sesję, zwraca `204`.
- `GET /api/users/me`: konto zalogowanej osoby; bez sesji `401`.
- Pozostałe `/api/**` wymagają zalogowania; wyjątkiem jest publiczny `/api/health`.
- Zapisy wymagają tokenu CSRF; brak lub nieprawidłowy token daje `403`. Frontend
  pobiera aktualny token przed zapisem, także po zmianie sesji podczas logowania.
- Cookie sesji jest `HttpOnly`, w produkcji także `Secure`, z `SameSite=Lax`.
  Frontend nie przechowuje hasła ani identyfikatora sesji w localStorage.
- Sesja trwa do 8 godzin bezczynności. Jest przechowywana w pamięci backendu:
  restart, wdrożenie lub ponowne uruchomienie uśpionej instancji wymaga logowania.
  Wariant ten zakłada jedną instancję backendu.
- Wylogowanie i odpowiedź `401` odmontowują widok konta i usuwają jego dane ze stanu
  React. Karty tej samej witryny informują się o logowaniu i wylogowaniu.

## Weryfikacja

Backend: `./mvnw verify` (Windows: `.\mvnw.cmd verify`). Frontend: `npm run build`
oraz `npm run lint`. Dotychczasowe testy domenowe korzystają z testowego użytkownika
i CSRF; osobne testy uwierzytelniania wykonują rzeczywiste logowanie z hasłem i sesją.

Źródła: [Spring Security — CSRF](https://docs.spring.io/spring-security/reference/servlet/exploits/csrf.html),
[Spring Security — sesja](https://docs.spring.io/spring-security/reference/servlet/authentication/persistence.html).
