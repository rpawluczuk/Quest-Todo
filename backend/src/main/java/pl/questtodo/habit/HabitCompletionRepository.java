package pl.questtodo.habit;

import java.time.LocalDate;
import java.util.Set;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface HabitCompletionRepository extends JpaRepository<HabitCompletionEntity, Long> {
    boolean existsByHabitIdAndDate(long habitId, LocalDate date);
    java.util.Optional<HabitCompletionEntity> findByHabitIdAndDate(long habitId, LocalDate date);
    void deleteByHabitIdAndDate(long habitId, LocalDate date);
    void deleteByHabitId(long habitId);

    @Query("select c.habit.id from HabitCompletionEntity c where c.habit.user.id = :userId and c.date = :date")
    Set<Long> findCompletedIds(@Param("userId") long userId, @Param("date") LocalDate date);

    interface WeeklyCount {
        Long getHabitId();
        long getCompletedDays();
    }

    @Query("select c.habit.id as habitId, count(c) as completedDays from HabitCompletionEntity c "
            + "where c.habit.user.id = :userId and c.date between :monday and :sunday group by c.habit.id")
    List<WeeklyCount> countWeek(@Param("userId") long userId, @Param("monday") LocalDate monday,
                               @Param("sunday") LocalDate sunday);

    long countByHabitIdAndDateBetween(long habitId, LocalDate monday, LocalDate sunday);
}
