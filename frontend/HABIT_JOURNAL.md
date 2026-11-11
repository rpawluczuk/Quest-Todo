# Dziennik nawyku — etapy 2–4

Akcja „Dziennik nawyku” w menu otwiera panel pod wybranym nawykiem.
Dotyczy aktywnych, zaplanowanych, wstrzymanych i zakończonych nawyków.
Wstrzymane nawyki wcześniej nie miały menu: nowe menu mieści się w istniejącym
wierszu akcji obok „Wznów”, bez dodawania wiersza do zwiniętego kafelka.

`HabitJournal` pobiera `GET /api/habits/{id}/entries?page=0&size=3` dopiero
po otwarciu. Pokazuje `totalElements`, trzy najnowsze wpisy, pusty stan,
ładowanie, błąd i ponowienie. Jednocześnie otwarty jest jeden dziennik.
Przycisk zamknięcia otrzymuje focus po otwarciu; zamknięcie zwraca go do menu.

`createHabitJournalStore` wykorzystuje istniejący cache dziennika, z osobną
instancją dla nawyków. Cache żyje razem ze stroną
Nawyki, zachowuje dane przy zamykaniu panelu i zmianie dnia, rozdziela identyfikatory
rodziców i deduplikuje żądania. Slot podglądu odpowiada stronie 0 o rozmiarze 3;
nie jest współdzielony z cache celów ani historią. Ponowne wejście na stronę tworzy
nowy cache. Opóźnione odpowiedzi trafiają wyłącznie do właściwego nawyku.

`JournalEntryItem` współdzieli prezentację, etykiety, daty Europe/Warsaw
i rozwijanie tekstu z `GoalEntryItem`. Dziennik celu nadal przekazuje swoje
menu i formularz jako elementy React. Wspólne `JournalEntryForm`,
`EditableJournalEntryItem` i `useJournalEditor` obsługują formularze inline,
menu, potwierdzenia odrzucenia zmian i usunięcia. Kontenery wybierają API.
Backend nie wymagał zmian. `JournalHistoryControls` współdzieli przyciski historii
z dziennikiem celu. Przy ponad trzech wpisach „Pokaż wszystkie wpisy” pobiera
pierwszą stronę po 10, a „Pokaż więcej” kolejne. „Pokaż mniej” przywraca podgląd
i focus nagłówka, zachowując pobraną historię w cache.

Historia korzysta z tego samego magazynu co dziennik celu. Po dodaniu lub usunięciu
odświeża załadowany zakres stron, aby przesunięcia offsetów nie powodowały luk
ani duplikatów. Edycja aktualizuje wpis w miejscu, bez zmiany kolejności i GET.
Spadek liczby wpisów do trzech przywraca widok kompaktowy. Błąd pobrania
zachowuje dotychczasowe wpisy i pozwala ponowić żądanie.

Przycisk `+` i akcja pustego stanu otwierają formularz tworzenia. Menu wpisu
pozwala edytować lub usunąć wpis. Formularz zachowuje treść po błędzie,
waliduje limit 5000 znaków i blokuje podwójny zapis. Enter dodaje nową linię,
Ctrl/Cmd+Enter zapisuje, Escape anuluje. Edycja bez zmian nie wysyła PATCH.
POST aktualizuje licznik i trzy najnowsze wpisy, PATCH zachowuje kolejność,
a DELETE ponownie pobiera pierwszą stronę. Nieudane odświeżenie po udanym
DELETE pozwala ponowić GET, bez ponownego usuwania wpisu.

Niezapisane zmiany wymagają potwierdzenia przy zmianie operacji, zamknięciu
panelu, przełączeniu nawyku lub dnia oraz lokalnej zmianie stanu nawyku.
Podczas zapisu te przejścia są blokowane. `WeekBar` wylicza zakres z zaakceptowanego
dnia, więc anulowanie przejścia zachowuje także wyświetlany tydzień.

Aktywne, wstrzymane i zaplanowane nawyki pozwalają na CRUD. Zakończenie
wyliczane jest dla dzisiejszej daty Europe/Warsaw na podstawie `endedOn`,
daty końcowej i limitu wykonań, niezależnie od oglądanego tygodnia.
Zakończony nawyk ukrywa akcje zapisu. Przedłużenie harmonogramu odblokowuje je
po otrzymaniu aktualnych danych nawyku. Odpowiedź 409 zachowuje szkic i pokazuje
komunikat backendu; nie ma synchronizacji czasu rzeczywistego.

Zmiany statusu zachowują historię i nie wywołują dodatkowych pobrań dziennika.
Szkice nawyków są przechowywane w pamięci strony, według identyfikatora nawyku,
aby przetrwały przeniesienie kafelka między sekcjami przy zewnętrznym odświeżeniu.
Po zakończeniu otwarty szkic pozostaje do skopiowania z ostrzeżeniem i zablokowanym
zapisem. Anulowanie lub potwierdzone odrzucenie usuwa szkic. Nie jest on utrwalany
w przeglądarce. Oczekujące operacje sprawdzają aktualny tryb przed wysłaniem zapisu.

Weryfikacja:

```shell
npm test
npm run build
node test/habitJournal.browser.mjs
node test/habitJournalManage.browser.mjs
node test/habitJournalHistory.browser.mjs
```

Test przeglądarkowy wymaga lokalnego Vite na porcie 5197 (lub `TEST_URL`),
Edge oraz istniejącej instalacji Playwright używanej przez pozostałe testy.
API jest mockowane. Obejmuje statusy, typy wpisów, cache, spóźnione odpowiedzi,
błędy/404, klawiaturę, tekst bez HTML, szerokości 320/360/390/1280 px
i brak żądań zmieniających dane podczas przeglądania. Test zarządzania sprawdza
CRUD, walidację, ochronę szkiców, potwierdzenia, błędy API, odświeżenie po DELETE,
reaktywację, formularze mobilne oraz brak zmian wykonań i punktów.
Test historii obejmuje strony po 10, CRUD starszych wpisów, ponowienia, cache,
zmiany statusów oraz ochronę szkicu przy zewnętrznym zakończeniu nawyku.
Etap 4 jest przygotowany do dalszej rozbudowy w etapie 5.
