package pl.questtodo.habit;

import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface HabitAwardRepository extends JpaRepository<HabitAwardEntity, UUID> {
    boolean existsByHabit_IdAndWeekStart(long habitId, LocalDate weekStart);
    Optional<HabitAwardEntity> findByIdAndHabit_Id(UUID id, long habitId);
    void deleteByHabit_Id(long habitId);
}
