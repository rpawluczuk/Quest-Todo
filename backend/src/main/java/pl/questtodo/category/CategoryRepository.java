package pl.questtodo.category;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CategoryRepository extends JpaRepository<CategoryEntity, Long> {
    List<CategoryEntity> findByUserIdOrderByNameKeyAscIdAsc(long userId);
    Optional<CategoryEntity> findByIdAndUserId(long id, long userId);
    boolean existsByUserIdAndNameKey(long userId, String nameKey);
    boolean existsByUserIdAndNameKeyAndIdNot(long userId, String nameKey, long id);
}
