package pl.questtodo.reward;

import jakarta.persistence.*;
import java.time.Instant;
import pl.questtodo.user.UserEntity;

@Entity
@Table(name = "purchases")
public class PurchaseEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private UserEntity user;
    @Column(name = "reward_id", nullable = false)
    private long rewardId;
    @Column(nullable = false, columnDefinition = "text")
    private String title;
    @Column(nullable = false)
    private int cost;
    @Column(name = "purchased_at")
    private Instant purchasedAt;
    @Column(name = "used_at")
    private Instant usedAt;

    protected PurchaseEntity() {}

    public PurchaseEntity(UserEntity user, Reward reward) {
        this.user = user;
        this.rewardId = reward.id();
        this.title = reward.title();
        this.cost = reward.cost();
        this.purchasedAt = Instant.now();
    }

    public Purchase toPurchase() { return new Purchase(id, rewardId, title, cost, purchasedAt, usedAt); }

    public record Purchase(long id, long rewardId, String title, int cost, Instant purchasedAt, Instant usedAt) {}
}
