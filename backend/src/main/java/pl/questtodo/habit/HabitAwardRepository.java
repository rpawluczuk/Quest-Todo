package pl.questtodo.habit;

import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface HabitAwardRepository extends JpaRepository<HabitAwardEntity, UUID> {
    boolean existsByHabit_IdAndWeekStart(long habitId, LocalDate weekStart);
    @Query("select a.habit.id from HabitAwardEntity a where a.habit.user.id = :userId and a.weekStart = :weekStart")
    java.util.Set<Long> findAwardedHabitIds(@Param("userId") long userId, @Param("weekStart") LocalDate weekStart);
    Optional<HabitAwardEntity> findByIdAndHabit_Id(UUID id, long habitId);
    void deleteByHabit_Id(long habitId);
}
