package pl.questtodo.task;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Objects;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.FetchType;
import pl.questtodo.user.UserEntity;
import pl.questtodo.category.CategoryEntity;
import pl.questtodo.goal.GoalEntity;

@Entity
@Table(name = "tasks")
public class TaskEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private UserEntity user;
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, columnDefinition = "text")
    private String title;

    @Column(columnDefinition = "text")
    private String description;

    @Column(nullable = false)
    private int points;

    @Column(nullable = false)
    private boolean completed;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(name = "in_focus", nullable = false)
    private boolean inFocus;

    @Column(name = "automatic_priority_dismissed", nullable = false)
    private boolean automaticPriorityDismissed;

    @Column(name = "due_date")
    private LocalDate dueDate;

    @Column(name = "due_time")
    private LocalTime dueTime;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id")
    private CategoryEntity category;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "goal_id")
    private GoalEntity goal;

    protected TaskEntity() {
    }

    public TaskEntity(String title, int points, String description, LocalDate dueDate, LocalTime dueTime,
                      CategoryEntity category, GoalEntity goal, UserEntity user) {
        this.user = user;
        this.title = title;
        this.points = points;
        this.description = description;
        this.dueDate = dueDate;
        this.dueTime = dueTime;
        this.category = category;
        this.goal = goal;
    }

    public boolean isCompleted() {
        return completed;
    }

    public long getId() { return id; }

    public int getPoints() { return points; }

    public void updateDetails(String title, int points, String description, boolean updateDescription,
                              LocalDate dueDate, LocalTime dueTime, boolean updateDueDate) {
        this.title = title;
        this.points = points;
        if (updateDescription) this.description = description;
        if (updateDueDate) {
            if (!Objects.equals(this.dueDate, dueDate) || !Objects.equals(this.dueTime, dueTime)) {
                this.automaticPriorityDismissed = false;
            }
            this.dueDate = dueDate;
            this.dueTime = dueTime;
        }
    }

    public void setCompleted(boolean completed) {
        if (this.completed != completed) {
            this.completedAt = completed ? Instant.now() : null;
        }
        this.completed = completed;
    }

    public void setManualFocus(boolean inFocus, LocalDate cutoff) {
        this.inFocus = inFocus;
        this.automaticPriorityDismissed = !inFocus && requiresPriority(cutoff);
    }

    public void setCategory(CategoryEntity category) {
        this.category = category;
    }

    public void setGoal(GoalEntity goal) {
        this.goal = goal;
    }

    public boolean belongsToGoal(long goalId) {
        return goal != null && goal.getId() == goalId;
    }

    public boolean requiresPriority(java.time.LocalDate cutoff) {
        return !completed && dueDate != null && !dueDate.isAfter(cutoff);
    }

    public void promoteIfDue(java.time.LocalDate cutoff) {
        if (!automaticPriorityDismissed && requiresPriority(cutoff)) inFocus = true;
    }

    public Task toTask() {
        return new Task(id, title, points, completed, inFocus, completedAt, description, dueDate, dueTime,
                category == null ? null : category.toCategory(),
                goal == null ? null : goal.getId(),
                goal == null ? null : goal.getTitle());
    }
}
