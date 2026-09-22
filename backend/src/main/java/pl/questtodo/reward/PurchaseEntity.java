package pl.questtodo.reward;

import jakarta.persistence.*;
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

    protected PurchaseEntity() {}

    public PurchaseEntity(UserEntity user, Reward reward) {
        this.user = user;
        this.rewardId = reward.id();
        this.title = reward.title();
        this.cost = reward.cost();
    }

    public Purchase toPurchase() { return new Purchase(id, rewardId, title, cost); }

    public record Purchase(long id, long rewardId, String title, int cost) {}
}
