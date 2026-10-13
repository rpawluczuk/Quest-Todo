package pl.questtodo.goal;

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
@Table(name = "goals")
public class GoalEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private UserEntity user;

    @Column(nullable = false, length = 120)
    private String title;

    @Column(name = "current_state", columnDefinition = "text")
    private String currentState;

    @Column(name = "desired_outcome", columnDefinition = "text")
    private String desiredOutcome;

    protected GoalEntity() {}

    public GoalEntity(String title, String currentState, String desiredOutcome, UserEntity user) {
        this.title = title;
        this.currentState = currentState;
        this.desiredOutcome = desiredOutcome;
        this.user = user;
    }

    public void updateDetails(String title, String currentState, String desiredOutcome) {
        this.title = title;
        this.currentState = currentState;
        this.desiredOutcome = desiredOutcome;
    }

    public Goal toGoal() { return new Goal(id, title, currentState, desiredOutcome); }
}
