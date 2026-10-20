package pl.questtodo.habit;

import java.util.List;
import java.util.Optional;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface HabitRepository extends JpaRepository<HabitEntity, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select h from HabitEntity h where h.id = :id")
    Optional<HabitEntity> findForSettlement(@Param("id") long id);

    @Query("select h.id from HabitEntity h where h.endDate < :today "
            + "and h.endedOn is null and h.completionBonusPoints is not null and h.requiredSuccessPercent is not null "
            + "and not exists (select a from HabitCompletionBonusAwardEntity a where a.habitId = h.id and a.settledOn is not null) "
            + "order by h.id")
    List<Long> findUnsettledDatedBonuses(@Param("today") java.time.LocalDate today);
    List<HabitEntity> findByUserIdOrderByIdAsc(long userId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select habit from HabitEntity habit where habit.id = :id and habit.user.id = :userId")
    Optional<HabitEntity> findForUpdate(@Param("id") long id, @Param("userId") long userId);
}
