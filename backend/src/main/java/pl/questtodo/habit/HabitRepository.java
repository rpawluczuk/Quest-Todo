package pl.questtodo.habit;

import java.util.List;
import java.util.Optional;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface HabitRepository extends JpaRepository<HabitEntity, Long> {
    List<HabitEntity> findByUserIdOrderByIdAsc(long userId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select habit from HabitEntity habit where habit.id = :id and habit.user.id = :userId")
    Optional<HabitEntity> findForUpdate(@Param("id") long id, @Param("userId") long userId);
}
