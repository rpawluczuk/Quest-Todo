package pl.questtodo.habit;

import java.util.Optional;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Page;
import org.springframework.data.jpa.repository.JpaRepository;

public interface HabitEntryRepository extends JpaRepository<HabitEntryEntity, Long> {
    Page<HabitEntryEntity> findByHabitIdOrderByCreatedAtDescIdDesc(long habitId, Pageable pageable);
    Optional<HabitEntryEntity> findByIdAndHabitId(long id, long habitId);
}
