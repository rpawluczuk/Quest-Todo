package pl.questtodo.reward;

import java.util.List;
import java.time.Instant;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import pl.questtodo.user.CurrentUserProvider;
import pl.questtodo.user.UserService;

@Service
@Transactional(readOnly = true)
public class RewardService {Usprawnij proces tworzenia celów w Quest Todo, umożliwiając użytkownikowi płynne przejście od utworzenia celu do planowania jego realizacji.

## 1. Obecny problem

Obecnie użytkownik:
1. Otwiera formularz tworzenia celu.
2. Wpisuje tytuł i opcjonalne szczegóły.
3. Klika „Dodaj cel”.
4. Cel zostaje utworzony.
5. Musi odnaleźć go na liście i ręcznie rozwinąć.
6. Dopiero wtedy może dodawać kamienie milowe, zadania i nawyki.

Chcę wyeliminować niepotrzebne kroki 5–6.

**Główna zasada: po utworzeniu celu użytkownik powinien od razu móc rozpocząć planowanie jego realizacji.**

## 2. Zachowanie po pomyślnym utworzeniu celu

Po kliknięciu „Dodaj cel” i otrzymaniu potwierdzenia poprawnego zapisu z backendu:

1. Zamknij formularz tworzenia celu.
2. Dodaj nowy cel do istniejącej listy celów.
3. **Automatycznie rozwiń nowo utworzony cel.**
4. Ustaw jego aktywną zakładkę na „Kamienie”.
5. Przewiń ekran tak, aby nagłówek nowego celu znalazł się w widocznym obszarze.
6. Umożliwiaj natychmiastowe dodawanie kamieni milowych, zadań i nawyków.

Nie otwieraj automatycznie formularza tworzenia pierwszego kamienia. Użytkownik sam zdecyduje, czy i od czego chce rozpocząć planowanie.

Nie otwieraj dodatkowego modala ani kreatora.

## 3. Pozycja nowego celu i przewijanie

Zachowaj dotychczasowe reguły sortowania celów.

Nie zmieniaj ich kolejności w bazie danych tylko po to, żeby nowy cel znalazł się na początku listy.

Po utworzeniu:
- Upewnij się, że nowy cel jest widoczny na liście.
- Przewiń stronę do jego nagłówka, najlepiej z niewielkim odstępem od górnej krawędzi.
- Nie przewijaj automatycznie do środka listy kamieni milowych.
- Nie powoduj wielokrotnych lub gwałtownych przeskoków ekranu.
- Uszanuj ustawienie `prefers-reduced-motion`.

Jeżeli lista jest stronicowana lub filtrowana, zadbaj o to, by użytkownik rzeczywiście mógł zobaczyć nowo utworzony cel.

## 4. Widok nowo utworzonego celu

Po automatycznym rozwinięciu zachowaj aktualny układ:

1. Nagłówek celu.
2. Panel „Kiedy uznam cel za osiągnięty?”, jeśli kryterium zostało określone.
3. Zakładki „Kamienie / Zadania / Nawyki”.
4. Zawartość zakładki „Kamienie”.
5. Opcjonalna, domyślnie zwinięta sekcja „Stan początkowy”.

Nie zmieniaj obecnego wyglądu tych elementów.

### Pusta zakładka „Kamienie”

Ponieważ nowy cel nie ma jeszcze kamieni milowych, wyświetl kompaktowy pusty stan:

**Zaplanuj drogę do celu**

„Dodaj pierwszy kamień milowy lub przejdź do zadań i nawyków.”

Pod komunikatem umieść subtelny przycisk:

**„+ Dodaj kamień milowy”**

Kliknięcie powinno otwierać istniejący formularz inline dodawania kamienia milowego.

Wykorzystaj ten sam mechanizm co przycisk `+` w zakładce „Kamienie”.

Nie dodawaj nowego formularza ani osobnej logiki tworzenia.

Pusty stan powinien być niewielki i spójny wizualnie z Quest Todo — bez dużych ilustracji i rozbudowanych kart.

Możesz zastosować ten sam pusty stan dla innych celów bez kamieni milowych, aby zachować spójność.

## 5. Możliwość rozpoczęcia od zadań lub nawyków

Nie wymuszaj dodawania kamieni milowych jako pierwszego kroku.

Użytkownik może:
- Dodać kamień milowy.
- Przejść do zakładki „Zadania” i utworzyć lub przypiąć zadanie.
- Przejść do zakładki „Nawyki” i utworzyć lub przypiąć nawyk.
- Zamknąć cel bez wykonywania dodatkowych działań.

Zachowaj istniejące popovery przycisku `+` w zakładkach „Zadania” i „Nawyki”.

Cel zostaje utworzony niezależnie od tego, czy użytkownik doda jakiekolwiek powiązane elementy.

## 6. Zachowanie przy nieudanym zapisie

Automatyczne rozwinięcie i przewinięcie powinno nastąpić **wyłącznie po pomyślnym utworzeniu celu**.

Jeżeli zapis się nie powiedzie:
- Pozostaw formularz tworzenia otwarty.
- Zachowaj wszystkie wpisane wartości.
- Pokaż istniejący komunikat błędu.
- Nie rozwijaj żadnego innego celu.
- Nie wykonuj automatycznego przewijania.

Zachowaj zabezpieczenie przed wielokrotnym wysłaniem formularza.

## 7. Stan komponentów

Zadbaj o prawidłowe zarządzanie stanem interfejsu.

- Automatycznie rozwijaj konkretny, nowo utworzony cel na podstawie jego rzeczywistego identyfikatora otrzymanego po zapisaniu.
- Nie identyfikuj go wyłącznie po tytule ani pozycji na liście.
- Zachowaj poprawne działanie innych celów.
- Nie zmieniaj danych ani stanu ukończenia istniejących celów.
- Nie wykonuj zbędnych ponownych zapytań do backendu, jeśli nowe dane są już dostępne.
- Przewijanie wykonaj dopiero wtedy, gdy element nowego celu rzeczywiście pojawi się w DOM.
- Nie używaj arbitralnych opóźnień czasowych do synchronizacji renderowania.

## 8. Formularz tworzenia celu — bez zmian

Zachowaj:
- Możliwość utworzenia celu wyłącznie z tytułem.
- Opcjonalne pole „Kiedy uznam cel za osiągnięty?”.
- Opcjonalne pole „Stan początkowy”.
- Przycisk „Dodaj szczegóły celu”.
- Dotychczasowe walidacje.
- Obecny wygląd formularza.

Nie dodawaj kamieni milowych, zadań ani nawyków bezpośrednio do formularza tworzenia celu.

## 9. Responsywność i dostępność

Sprawdź działanie na ekranach 320–390 px oraz na desktopie.

- Nowy cel powinien być widoczny po zapisaniu.
- Automatyczne przewijanie nie może ukrywać jego nagłówka.
- Nie może występować poziome przewijanie.
- Użytkownik powinien móc od razu korzystać z zakładek i przycisku `+`.
- Zachowaj logiczne zarządzanie fokusem po zamknięciu formularza.
- Nie przenoś fokusu do nieistniejącego lub ukrytego elementu.

## 10. Zakres zmian

- Zmień przede wszystkim zachowanie aplikacji po pomyślnym utworzeniu celu.
- Nie przebudowuj sekcji „Cele”.
- Nie zmieniaj logiki biznesowej ani modelu danych.
- Nie modyfikuj backendu ani API, jeśli obecna odpowiedź zawiera identyfikator utworzonego celu.
- Nie zmieniaj formularzy tworzenia zadań, nawyków i kamieni milowych.
- Nie dodawaj wieloetapowego kreatora.
- Nie wymagaj uzupełnienia kryterium sukcesu ani kamieni milowych.

## 11. Testy

Zweryfikuj:

1. Utworzenie celu wyłącznie z tytułem.
2. Utworzenie celu z dodatkowymi szczegółami.
3. Automatyczne rozwinięcie właściwego celu.
4. Domyślny wybór zakładki „Kamienie”.
5. Poprawne przewinięcie do nowego celu.
6. Dodanie pierwszego kamienia z pustego stanu.
7. Przejście do zadań i nawyków bez tworzenia kamieni.
8. Zachowanie po nieudanym zapisie.
9. Tworzenie kolejnych celów.
10. Poprawne działanie na telefonach.
11. Brak regresji w obsłudze istniejących celów.

## Oczekiwany rezultat

Tworzenie celu przebiega w dwóch naturalnych etapach:

**1. Określ cel** — wpisz tytuł i ewentualnie dodatkowe informacje.

**2. Zaplanuj realizację** — po zapisaniu nowy cel automatycznie się rozwija, a użytkownik może dodawać kamienie milowe, zadania i nawyki.

Drugi etap nie jest obowiązkowy ani częścią kreatora.

**Najważniejsze: użytkownik powinien móc płynnie przejść od pomysłu na cel do planowania jego realizacji, bez ręcznego wyszukiwania i rozwijania nowo utworzonego celu.**
    private final RewardRepository rewardRepository;
    private final PurchaseRepository purchases;
    private final UserService users;
    private final CurrentUserProvider currentUser;

    public RewardService(RewardRepository rewardRepository, PurchaseRepository purchases, UserService users,
                         CurrentUserProvider currentUser) {
        this.rewardRepository = rewardRepository;
        this.purchases = purchases;
        this.users = users;
        this.currentUser = currentUser;
    }

    public List<PurchaseEntity.Purchase> getPurchases() {
        return purchases.findByUserIdOrderByIdAsc(currentUser.getUserId()).stream()
                .map(PurchaseEntity::toPurchase).toList();
    }

    @Transactional
    public PurchaseEntity.Purchase buyReward(long id) {
        var user = users.lockCurrentUser();
        var entity = findCurrentUsersReward(id);
        if (!entity.isAvailable()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ta nagroda jednorazowa została już kupiona.");
        }
        var reward = entity.toReward();
        if (user.getPoints() < reward.cost()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Za mało punktów.");
        }
        user.addPoints(-reward.cost());
        var purchase = purchases.save(new PurchaseEntity(user, reward)).toPurchase();
        entity.recordPurchase(purchase.id());
        return purchase;
    }

    public List<Reward> getRewards() {
        return rewardRepository.findByUserIdAndDeletedFalseOrderByIdAsc(currentUser.getUserId()).stream()
                .filter(RewardEntity::isAvailable)
                .map(RewardEntity::toReward)
                .toList();
    }

    @Transactional
    public PurchaseEntity.Purchase usePurchase(long id) {
        long userId = currentUser.getUserId();
        int updated = purchases.useIfAvailable(id, userId, Instant.now());
        var purchase = purchases.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Zakup nie istnieje."));
        if (updated == 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ta nagroda została już wykorzystana.");
        }
        return purchase.toPurchase();
    }

    @Transactional
    public Reward createReward(String title, int cost, RewardPurchaseType purchaseType) {
        var reward = new RewardEntity(title, cost, users.currentReference());
        reward.changePurchaseType(purchaseType);
        return rewardRepository.save(reward).toReward();
    }

    @Transactional
    public Reward updateReward(long id, String title, int cost, RewardPurchaseType purchaseType) {
        users.lockCurrentUser();
        var reward = findCurrentUsersReward(id);
        reward.updateDetails(title, cost);
        reward.changePurchaseType(purchaseType);
        return reward.toReward();
    }

    @Transactional
    public void deleteReward(long id) {
        // Serialize with purchases so an offer cannot be bought after its deletion commits.
        users.lockCurrentUser();
        var reward = findCurrentUsersReward(id);
        reward.delete();
    }

    private RewardEntity findCurrentUsersReward(long id) {
        return rewardRepository.findByIdAndUserIdAndDeletedFalse(id, currentUser.getUserId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Nagroda nie istnieje."));
    }
}
