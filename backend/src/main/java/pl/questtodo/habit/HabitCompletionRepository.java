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
    java.util.Optional<HabitCompletionEntity> findFirstByHabitIdAndDateBetweenOrderByDateDescIdDesc(
            long habitId, LocalDate monday, LocalDate sunday);
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

    @Query("select c.habit.id as habitId, count(c) as completedDays from HabitCompletionEntity c "
            + "where c.habit.user.id = :userId group by c.habit.id")
    List<WeeklyCount> countAll(@Param("userId") long userId);
    @Query("select c.habit.id as habitId, count(c) as completedDays from HabitCompletionEntity c "
            + "where c.habit.user.id = :userId and c.date <= :date group by c.habit.id")
    List<WeeklyCount> countThrough(@Param("userId") long userId, @Param("date") LocalDate date);
    long countByHabitId(long habitId);
    boolean existsByHabitIdAndDateBefore(long habitId, LocalDate date);
    boolean existsByHabitIdAndDateAfter(long habitId, LocalDate date);
    long countByHabitIdAndDateLessThanEqual(long habitId, LocalDate date);

    long countByHabitIdAndDateBetween(long habitId, LocalDate monday, LocalDate sunday);
}
