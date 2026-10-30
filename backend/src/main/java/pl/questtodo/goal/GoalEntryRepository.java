package pl.questtodo.goal;

import java.util.Optional;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GoalEntryRepository extends JpaRepository<GoalEntryEntity, Long> {
    Slice<GoalEntryEntity> findByGoalIdOrderByCreatedAtDescIdDesc(long goalId, Pageable pageable);
    Optional<GoalEntryEntity> findByIdAndGoalId(long id, long goalId);
}
