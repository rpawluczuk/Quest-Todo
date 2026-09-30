package pl.questtodo.reward;

import java.util.List;
import java.util.Optional;
import java.time.Instant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PurchaseRepository extends JpaRepository<PurchaseEntity, Long> {
    List<PurchaseEntity> findByUserIdOrderByIdAsc(long userId);

    Optional<PurchaseEntity> findByIdAndUserId(long id, long userId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE PurchaseEntity p SET p.usedAt = :usedAt WHERE p.id = :id AND p.user.id = :userId AND p.usedAt IS NULL")
    int useIfAvailable(@Param("id") long id, @Param("userId") long userId, @Param("usedAt") Instant usedAt);
}
