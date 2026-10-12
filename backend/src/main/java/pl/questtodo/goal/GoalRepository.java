package pl.questtodo.goal;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;

public interface GoalRepository extends JpaRepository<GoalEntity, Long> {
    List<GoalEntity> findByUserIdOrderByIdAsc(long userId);
    Optional<GoalEntity> findByIdAndUserId(long id, long userId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select goal from GoalEntity goal where goal.id = :id and goal.user.id = :userId")
    Optional<GoalEntity> findForUpdate(@Param("id") long id, @Param("userId") long userId);
}
