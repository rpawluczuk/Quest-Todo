package pl.questtodo.habit;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface HabitTargetRepository extends JpaRepository<HabitTargetEntity, Long> {
    List<HabitTargetEntity> findByHabit_IdOrderByEffectiveFromAsc(long habitId);
    List<HabitTargetEntity> findByHabitUserIdOrderByEffectiveFromAsc(long userId);
    void deleteByHabit_Id(long habitId);
}
