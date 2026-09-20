package pl.questtodo.task;

import java.util.Optional;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TaskRepository extends JpaRepository<TaskEntity, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select task from TaskEntity task where task.id = :id")
    Optional<TaskEntity> findForUpdate(@Param("id") long id);
}
