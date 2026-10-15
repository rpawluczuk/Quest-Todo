package pl.questtodo.reward;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import pl.questtodo.user.UserEntity;

@Entity
@Table(name = "rewards")
public class RewardEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private UserEntity user;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, columnDefinition = "text")
    private String title;

    @Column(nullable = false)
    private int cost;

    @Column(nullable = false)
    private boolean deleted;

    @jakarta.persistence.Enumerated(jakarta.persistence.EnumType.STRING)
    @Column(name = "purchase_type", nullable = false)
    private RewardPurchaseType purchaseType = RewardPurchaseType.REPEATABLE;

    @Column(name = "consumed_by_purchase_id")
    private Long consumedByPurchaseId;

    public boolean isAvailable() {
        return purchaseType == RewardPurchaseType.REPEATABLE || consumedByPurchaseId == null;
    }

    public void changePurchaseType(RewardPurchaseType type) {
        if (type != null && type != purchaseType) {
            purchaseType = type;
            consumedByPurchaseId = null;
        }
    }

    public void recordPurchase(long purchaseId) {
        if (purchaseType == RewardPurchaseType.ONE_TIME) consumedByPurchaseId = purchaseId;
    }

    public void delete() {
        deleted = true;
    }

    protected RewardEntity() {
    }

    public RewardEntity(String title, int cost, UserEntity user) {
        this.title = title;
        this.cost = cost;
        this.user = user;
    }

    public Reward toReward() {
        return new Reward(id, title, cost, purchaseType);
    }

    public void updateDetails(String title, int cost) {
        this.title = title;
        this.cost = cost;
    }
}
