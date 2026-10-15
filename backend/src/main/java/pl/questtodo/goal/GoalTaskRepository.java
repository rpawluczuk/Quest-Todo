package pl.questtodo.goal;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;
import pl.questtodo.task.TaskEntity;

public interface GoalTaskRepository extends JpaRepository<GoalTaskEntity, Long> {
    boolean existsByGoalIdAndTaskId(long goalId, long taskId);
    void deleteByGoalIdAndTaskId(long goalId, long taskId);
    @Modifying(flushAutomatically = true)
    @Query("delete from GoalTaskEntity link where link.task.id = :taskId")
    void deleteByTaskId(@Param("taskId") long taskId);

    @Query("select link.task from GoalTaskEntity link where link.goal.id = :goalId "
            + "and link.goal.user.id = :userId and link.task.user.id = :userId order by link.task.id")
    List<TaskEntity> findTasks(@Param("goalId") long goalId, @Param("userId") long userId);

    interface TaskGoalTitle {
        long getTaskId();
        long getGoalId();
        String getGoalTitle();
    }

    @Query("select link.task.id as taskId, link.goal.id as goalId, link.goal.title as goalTitle from GoalTaskEntity link "
            + "where link.goal.user.id = :userId and link.task.user.id = :userId "
            + "and link.task.id in :taskIds order by link.task.id, link.goal.id")
    List<TaskGoalTitle> findGoalTitles(@Param("userId") long userId, @Param("taskIds") List<Long> taskIds);

    @Query("select task from TaskEntity task where task.user.id = :userId "
            + "and task.completed = :completed "
            + "and (:query = '' or lower(task.title) like concat('%', lower(:query), '%')) "
            + "and not exists (select link.id from GoalTaskEntity link "
            + "where link.goal.id = :goalId and link.task.id = task.id) "
            + "order by task.inFocus desc, task.id desc")
    Slice<TaskEntity> findAvailableTasks(@Param("goalId") long goalId,
                                         @Param("userId") long userId,
                                         @Param("completed") boolean completed,
                                         @Param("query") String query,
                                         Pageable pageable);
}
