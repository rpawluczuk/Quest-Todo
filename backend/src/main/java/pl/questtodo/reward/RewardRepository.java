package pl.questtodo.reward;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface RewardRepository extends JpaRepository<RewardEntity, Long> {
    List<RewardEntity> findByUserIdAndDeletedFalseOrderByIdAsc(long userId);
    Optional<RewardEntity> findByIdAndUserIdAndDeletedFalse(long id, long userId);
}
