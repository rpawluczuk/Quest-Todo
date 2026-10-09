package pl.questtodo.habit;

import java.time.LocalDate;
import java.util.Set;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface HabitCompletionRepository extends JpaRepository<HabitCompletionEntity, Long> {
    boolean existsByHabitIdAndDate(long habitId, LocalDate date);
    void deleteByHabitIdAndDate(long habitId, LocalDate date);
    void deleteByHabitId(long habitId);

    @Query("select c.habit.id from HabitCompletionEntity c where c.habit.user.id = :userId and c.date = :date")
    Set<Long> findCompletedIds(@Param("userId") long userId, @Param("date") LocalDate date);
}
