package pl.questtodo.task;

import jakarta.persistence.*;
import pl.questtodo.task.dto.SubtaskResponse;

@Entity
@Table(name = "subtasks")
public class SubtaskEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "task_id", nullable = false)
    private TaskEntity task;

    @Column(nullable = false, length = 120)
    private String title;

    @Column(nullable = false)
    private boolean completed;

    @Column(nullable = false)
    private int position;

    protected SubtaskEntity() {}

    public SubtaskEntity(TaskEntity task, String title, int position) {
        this.task = task;
        this.title = title;
        this.position = position;
    }

    public void setTitle(String title) { this.title = title; }
    public void setCompleted(boolean completed) { this.completed = completed; }
    public long getId() { return id; }
    public void setPosition(int position) { this.position = position; }

    public SubtaskResponse toResponse() {
        return new SubtaskResponse(id, title, completed, position);
    }
}
