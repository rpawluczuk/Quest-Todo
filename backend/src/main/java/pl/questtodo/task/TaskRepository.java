package pl.questtodo.task;

import java.util.Optional;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TaskRepository extends JpaRepository<TaskEntity, Long> {
    @org.springframework.data.jpa.repository.Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update TaskEntity task set task.inFocus = true where task.user.id = :userId "
            + "and task.completed = false and task.inFocus = false and task.automaticPriorityDismissed = false "
            + "and task.dueDate <= :cutoff")
    int promoteDueTasks(@Param("userId") long userId, @Param("cutoff") java.time.LocalDate cutoff);

    @org.springframework.data.jpa.repository.Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update TaskEntity task set task.inFocus = true where task.completed = false "
            + "and task.inFocus = false and task.automaticPriorityDismissed = false and task.dueDate <= :cutoff")
    int promoteAllDueTasks(@Param("cutoff") java.time.LocalDate cutoff);

    java.util.List<TaskEntity> findByUserIdAndCompletedFalseOrderByIdAsc(long userId);
    long countByUserIdAndCompletedTrue(long userId);
    @Query("select task from TaskEntity task where task.user.id = :userId and task.completed = true order by task.completedAt desc nulls last, task.id desc")
    org.springframework.data.domain.Page<TaskEntity> findHistory(@Param("userId") long userId, org.springframework.data.domain.Pageable pageable);
    Optional<TaskEntity> findByIdAndUserId(long id, long userId);
    java.util.List<TaskEntity> findByUserIdOrderByIdAsc(long userId);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select task from TaskEntity task where task.id = :id and task.user.id = :userId")
    Optional<TaskEntity> findForUpdate(@Param("id") long id, @Param("userId") long userId);
}
