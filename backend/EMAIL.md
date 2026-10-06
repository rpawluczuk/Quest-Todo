# Adres e-mail i jego potwierdzanie

Adres jest opcjonalny przy rejestracji oraz dla istniejących kont. W menu avatara
„Adres e-mail” można dodać lub zmienić adres i ponownie wysłać wiadomość. Każda
z tych operacji po zalogowaniu wymaga obecnego hasła. Stary potwierdzony adres
pozostaje aktywny do potwierdzenia nowego. Login nadal służy do logowania.
Odzyskiwanie zapomnianego hasła jest osobnym, jeszcze niezaimplementowanym etapem.

## Lokalny test bez dostawcy poczty

1. Uruchom lokalną bazę oraz backend z katalogu `backend`:
   `./mvnw.cmd spring-boot:run "-Dspring-boot.run.profiles=local"`.
2. Uruchom frontend (`npm run dev`) pod `http://localhost:5173`.
3. Zaloguj się, wybierz avatar → Adres e-mail, wpisz np. `radek@example.com`
   i obecne hasło. Kliknij „Wyślij link potwierdzający”.
4. Otwórz najnowszy plik `.txt` w `backend/.local-mail/` (katalog jest względem
   katalogu uruchomienia backendu). To lokalna skrzynka, nie prawdziwa wysyłka.
5. Otwórz link z wiadomości i kliknij „Potwierdź adres”. Wróć do aplikacji,
   otwórz ponownie „Adres e-mail” i sprawdź status.
6. Sprawdź zmianę na drugi adres: pierwszy pozostaje potwierdzony do użycia
   nowego linku. Powiadomienie na poprzedni adres pojawi się w skrzynce w ciągu
   około minuty.

Pliki skrzynki zawierają działające lokalne linki, są ignorowane przez Git.
Tryb `file` wymaga profilu `local`; nie jest dopuszczony w zwykłym profilu produkcji.
Jeśli frontend ma inny adres/port, ustaw `APP_PUBLIC_URL` na jego dokładny adres.

## Produkcja: Brevo przez HTTPS

Kod nie tworzy konta u dostawcy. Na początek możesz użyć własnego adresu Gmail
bez kupowania domeny. W Brevo dodaj nadawcę w `Settings → Senders, Domains &
Dedicated IPs → Senders`, podaj nazwę `Quest Todo` i swój adres e-mail, a następnie
potwierdź go sześciocyfrowym kodem otrzymanym na tę skrzynkę. Brevo zaleca własną
domenę ze względu na dostarczalność, ale nie jest ona wymagana do tego wariantu.

1. Załóż konto Brevo i dodaj oraz potwierdź adres nadawcy.
2. W `Settings → SMTP & API → API Keys` utwórz klucz API i zapisz go od razu.
3. W Environment usługi `quest-todo-api` na Render ustaw:

| Zmienna | Wartość |
| --- | --- |
| `MAIL_MODE` | `brevo` |
| `MAIL_API_KEY` | klucz API Brevo; tylko w środowisku backendu |
| `MAIL_FROM` | sam potwierdzony adres nadawcy, np. `twoj-adres@gmail.com` |
| `MAIL_FROM_NAME` | `Quest Todo` (opcjonalne, taka jest wartość domyślna) |
| `APP_PUBLIC_URL` | `https://quest-todo-api.onrender.com` — adres strony aplikacji |

4. Wykonaj świeżą kopię bazy, następnie wdróż commit. Migracja V9 dodaje osobne
   tabele; nie aktualizuje istniejących użytkowników, zadań, nagród ani zakupów.
5. Sprawdź prawdziwą wysyłkę na własną skrzynkę, potwierdzenie, ponowną wysyłkę
   oraz zmianę adresu. Integracja lokalna/testowa nie dowodzi dostarczania do skrzynki.

Bez konfiguracji domyślny `MAIL_MODE=disabled` pozwala nadal korzystać z aplikacji
i rejestrować konta bez e-maila. Próba wysyłki zwraca komunikat o niedostępności.
Jeżeli wysyłka przy rejestracji zawiedzie, konto zostaje utworzone, a odpowiedź 201
wyjaśnia, że adres należy dodać po zalogowaniu. Nie należy ponawiać rejestracji.

Przy adresie z bezpłatnej skrzynki Brevo może technicznie zastąpić adres `From`,
aby spełnić wymagania dostawców poczty. Nazwa `Quest Todo` pozostanie widoczna,
ale dostarczalność będzie słabsza niż po podłączeniu własnej domeny.

Render Free blokuje standardowe porty SMTP — integracja używa API HTTPS Brevo.
Źródła: [Render SMTP](https://render.com/changelog/free-web-services-will-no-longer-allow-outbound-traffic-to-smtp-ports),
[Brevo: tworzenie nadawcy](https://help.brevo.com/hc/en-us/articles/208836149-Create-a-new-sender-From-name-and-From-email),
[Brevo: wysyłka przez API](https://developers.brevo.com/reference/send-transac-email),
[Brevo: wymagania dla nadawców](https://help.brevo.com/hc/en-us/articles/14925263522578-Comply-with-Gmail-Yahoo-and-Microsoft-s-requirements-for-email-senders).

## Zasady i API

- Adresy normalizowane są do małych liter, bez usuwania kropek lub `+aliasów`.
  Obsługiwane są zwykłe adresy ASCII, do 254 znaków (część lokalna do 64).
- Jeden potwierdzony adres należy do jednego konta. Adres oczekujący nie rezerwuje
  skrzynki: o przypisaniu decyduje potwierdzenie. Unikalność wymusza także baza.
- Token to 32 losowe bajty. W bazie jest tylko SHA-256, nigdy jawny token.
  Link jest ważny 24 godziny, jednorazowy, a ponowna wysyłka unieważnia poprzedni.
- Link używa fragmentu URL (`#verify-email=...`), który nie trafia do serwera
  jako część adresu. Strona usuwa go z bieżącej historii i wymaga kliknięcia
  przycisku; otwarcie przez skaner pocztowy nie zużywa linku. Po odświeżeniu strony
  przed potwierdzeniem należy ponownie otworzyć oryginalny link z wiadomości.
- `GET /api/users/me/email`: własny potwierdzony i oczekujący adres oraz termin linku.
- `POST /api/users/me/email`: JSON `email`, `password`.
- `POST /api/users/me/email/resend`: JSON `password` (adres pochodzi z bazy).
- `POST /api/auth/email/confirm`: JSON `token`; publiczny, wymaga CSRF, nie loguje.
- Wszystkie zapisy wymagają CSRF. Operacje na koncie wymagają sesji.
- Limity: minimum 60 sekund między wysyłkami konta, maks. 5 wiadomości/godzinę
  na konto i odbiorcę, maks. 30/godzinę dla całej aplikacji. Dotyczą także rejestracji.
  Liczniki są w bazie, więc restart ich nie zeruje. Przekroczenie daje 429.
- Przy błędzie dostawcy zmiana oczekującego adresu jest wycofywana; poprzedni link
  pozostaje ważny. Wysłanie wiadomości i commit bazy nie są jedną transakcją zewnętrzną:
  przy awarii po przyjęciu wiadomości przez dostawcę link może okazać się nieważny.
  Użytkownik może wtedy poprosić o nowy link.
- Powiadomienie na stary adres trafia do trwałej kolejki w tej samej transakcji,
  która potwierdza nowy. Wysyłka co minutę, po błędzie ponowienie po 10 minutach.
  Brevo dostaje stały klucz idempotencji wiadomości; dostawca zachowuje go 30 minut.
  Awaria dłuższa niż ten czas może skutkować powtórzonym powiadomieniem.

Przy skalowaniu ruchu należy dostosować globalne limity do dostawcy i liczby kont.
