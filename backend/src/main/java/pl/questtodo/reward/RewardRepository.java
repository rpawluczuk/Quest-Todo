package pl.questtodo.reward;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Sort;
import java.util.List;
import java.util.Optional;

public interface RewardRepository extends JpaRepository<RewardEntity, Long> {
    List<RewardEntity> findByDeletedFalse(Sort sort);
    Optional<RewardEntity> findByIdAndDeletedFalse(long id);
}
