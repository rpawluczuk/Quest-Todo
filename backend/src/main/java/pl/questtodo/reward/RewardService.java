package pl.questtodo.reward;

import java.util.List;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import pl.questtodo.user.UserService;

@Service
@Transactional(readOnly = true)
public class RewardService {
    private final RewardRepository rewardRepository;
    private final PurchaseRepository purchases;
    private final UserService users;

    public RewardService(RewardRepository rewardRepository, PurchaseRepository purchases, UserService users) {
        this.rewardRepository = rewardRepository;
        this.purchases = purchases;
        this.users = users;
    }

    public List<PurchaseEntity.Purchase> getPurchases() {
        return purchases.findByUserIdOrderByIdAsc(UserService.CURRENT_USER_ID).stream()
                .map(PurchaseEntity::toPurchase).toList();
    }

    @Transactional
    public PurchaseEntity.Purchase buyReward(long id) {
        var user = users.lockCurrentUser();
        var reward = rewardRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Nagroda nie istnieje."))
                .toReward();
        if (user.getPoints() < reward.cost()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Za mało punktów.");
        }
        user.addPoints(-reward.cost());
        return purchases.save(new PurchaseEntity(user, reward)).toPurchase();
    }

    public List<Reward> getRewards() {
        return rewardRepository.findAll(Sort.by("id")).stream()
                .map(RewardEntity::toReward)
                .toList();
    }
}
