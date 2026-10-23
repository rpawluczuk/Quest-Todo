package pl.questtodo.goal;

import jakarta.persistence.*;

@Entity
@Table(name = "milestones")
public class MilestoneEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "goal_id", nullable = false)
    private GoalEntity goal;
    @Column(nullable = false, length = 120)
    private String title;
    @Column(nullable = false)
    private boolean completed;
    @Column(nullable = false)
    private int position;

    protected MilestoneEntity() {}
    MilestoneEntity(GoalEntity goal, String title, int position) {
        this.goal = java.util.Objects.requireNonNull(goal);
        this.title = title;
        this.position = position;
    }
    public int getPosition() { return position; }
    public void setPosition(int position) { this.position = position; }
    public long getId() { return id; }
    public void rename(String title) { this.title = title; }
    void detach() { this.goal = null; }
    public void setCompleted(boolean completed) { this.completed = completed; }
    public Milestone toMilestone() { return new Milestone(id, title, completed, position); }
}
