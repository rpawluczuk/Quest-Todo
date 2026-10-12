package pl.questtodo.goal;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import pl.questtodo.task.TaskEntity;

public interface GoalTaskRepository extends JpaRepository<GoalTaskEntity, Long> {
    boolean existsByGoalIdAndTaskId(long goalId, long taskId);
    void deleteByGoalIdAndTaskId(long goalId, long taskId);

    @Query("select link.task from GoalTaskEntity link where link.goal.id = :goalId "
            + "and link.goal.user.id = :userId and link.task.user.id = :userId order by link.task.id")
    List<TaskEntity> findTasks(@Param("goalId") long goalId, @Param("userId") long userId);
}
