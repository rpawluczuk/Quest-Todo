package pl.questtodo.reward;

import java.util.List;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class RewardService {
    private final RewardRepository rewardRepository;

    public RewardService(RewardRepository rewardRepository) {
        this.rewardRepository = rewardRepository;
    }

    public List<Reward> getRewards() {
        return rewardRepository.findAll(Sort.by("id")).stream()
                .map(RewardEntity::toReward)
                .toList();
    }
}
