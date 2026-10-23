package pl.questtodo.goal;

import jakarta.persistence.Column;
import jakarta.persistence.CascadeType;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
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
    @OneToMany(mappedBy = "goal", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("position ASC")
    private List<MilestoneEntity> milestones = new ArrayList<>();

    public List<MilestoneEntity> getMilestones() { return Collections.unmodifiableList(milestones); }
    public void removeMilestone(MilestoneEntity milestone) {
        if (milestones.remove(milestone)) milestone.detach();
    }

    public MilestoneEntity addMilestone(String title) {
        int position = milestones.stream().mapToInt(MilestoneEntity::getPosition).max().orElse(-1) + 1;
        MilestoneEntity milestone = new MilestoneEntity(this, title, position);
        milestones.add(milestone);
        return milestone;
    }

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

    public long getId() { return id; }

    public String getTitle() { return title; }

    public Goal toGoal() { return new Goal(id, title, currentState, desiredOutcome); }
}
