package pl.questtodo.goal;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GoalRepository extends JpaRepository<GoalEntity, Long> {
    List<GoalEntity> findByUserIdOrderByIdAsc(long userId);
    Optional<GoalEntity> findByIdAndUserId(long id, long userId);
}
