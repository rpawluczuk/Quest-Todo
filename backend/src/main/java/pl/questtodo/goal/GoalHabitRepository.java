package pl.questtodo.goal;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;

public interface GoalHabitRepository extends JpaRepository<GoalHabitEntity, Long> {
    boolean existsByGoalIdAndHabitId(long goalId, long habitId);
    void deleteByGoalIdAndHabitId(long goalId, long habitId);

    @Query("select new pl.questtodo.goal.GoalHabit(link.habit.id, link.habit.name) from GoalHabitEntity link "
            + "where link.goal.id = :goalId and link.goal.user.id = :userId "
            + "and link.habit.user.id = :userId order by link.habit.id")
    List<GoalHabit> findHabits(@Param("goalId") long goalId, @Param("userId") long userId);

    interface HabitGoalTitle {
        long getHabitId();
        String getGoalTitle();
    }

    @Query("select link.habit.id as habitId, link.goal.title as goalTitle from GoalHabitEntity link "
            + "where link.goal.user.id = :userId and link.habit.user.id = :userId "
            + "and link.habit.id in :habitIds order by link.habit.id, link.goal.id")
    List<HabitGoalTitle> findGoalTitles(@Param("userId") long userId, @Param("habitIds") List<Long> habitIds);

    @Query("select new pl.questtodo.goal.GoalHabit(habit.id, habit.name) from HabitEntity habit "
            + "where habit.user.id = :userId "
            + "and (:query = '' or lower(habit.name) like concat('%', lower(:query), '%')) "
            + "and not exists (select link.id from GoalHabitEntity link "
            + "where link.goal.id = :goalId and link.habit.id = habit.id) order by habit.id desc")
    Slice<GoalHabit> findAvailableHabits(@Param("goalId") long goalId, @Param("userId") long userId,
                                        @Param("query") String query, Pageable pageable);
}
