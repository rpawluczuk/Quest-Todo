package pl.questtodo.reward;

import java.util.List;
import java.time.Instant;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import pl.questtodo.user.CurrentUserProvider;
import pl.questtodo.user.UserService;

@Service
@Transactional(readOnly = true)
public class RewardService {
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
        var reward = rewardRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Nagroda nie istnieje."))
                .toReward();
        if (user.getPoints() < reward.cost()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Za mało punktów.");
        }
        user.addPoints(-reward.cost());
        return purchases.save(new PurchaseEntity(user, reward)).toPurchase();
    }

    public List<Reward> getRewards() {
        return rewardRepository.findByDeletedFalse(Sort.by("id")).stream()
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
    public Reward createReward(String title, int cost) {
        return rewardRepository.save(new RewardEntity(title, cost)).toReward();
    }

    @Transactional
    public Reward updateReward(long id, String title, int cost) {
        users.lockCurrentUser();
        var reward = rewardRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Nagroda nie istnieje."));
        reward.updateDetails(title, cost);
        return reward.toReward();
    }

    @Transactional
    public void deleteReward(long id) {
        // Serialize with purchases so an offer cannot be bought after its deletion commits.
        users.lockCurrentUser();
        var reward = rewardRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Nagroda nie istnieje."));
        reward.delete();
    }
}
