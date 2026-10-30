package pl.questtodo.habit;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface HabitStatusPeriodRepository extends JpaRepository<HabitStatusPeriod, Long> {
    Optional<HabitStatusPeriod> findByHabitIdAndEndedAtIsNull(long habitId);
    List<HabitStatusPeriod> findByHabitIdOrderByStartedAtAscIdAsc(long habitId);
    void deleteByHabitId(long habitId);
}
