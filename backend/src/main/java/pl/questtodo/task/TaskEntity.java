package pl.questtodo.task;

import java.time.Instant;

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

    @Column(nullable = false)
    private int points;

    @Column(nullable = false)
    private boolean completed;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(name = "in_focus", nullable = false)
    private boolean inFocus;

    protected TaskEntity() {
    }

    public TaskEntity(String title, int points, UserEntity user) {
        this.user = user;
        this.title = title;
        this.points = points;
    }

    public boolean isCompleted() {
        return completed;
    }

    public int getPoints() { return points; }

    public void updateDetails(String title, int points) {
        this.title = title;
        this.points = points;
    }

    public void setCompleted(boolean completed) {
        if (this.completed != completed) {
            this.completedAt = completed ? Instant.now() : null;
        }
        this.completed = completed;
    }

    public void setInFocus(boolean inFocus) {
        this.inFocus = inFocus;
    }

    public Task toTask() {
        return new Task(id, title, points, completed, inFocus, completedAt);
    }
}
