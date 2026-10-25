package pl.questtodo.task;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SubtaskRepository extends JpaRepository<SubtaskEntity, Long> {
    List<SubtaskEntity> findByTaskIdOrderByPositionAscIdAsc(long taskId);
    Optional<SubtaskEntity> findByIdAndTaskId(long id, long taskId);

    @Query("select coalesce(max(s.position), -1) from SubtaskEntity s where s.task.id = :taskId")
    int maxPosition(@Param("taskId") long taskId);
}
