package pl.questtodo.goal;

import jakarta.persistence.*;
import pl.questtodo.task.TaskEntity;

@Entity
@Table(name = "goal_tasks")
public class GoalTaskEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "goal_id", nullable = false)
    private GoalEntity goal;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "task_id", nullable = false)
    private TaskEntity task;

    protected GoalTaskEntity() {}

    public GoalTaskEntity(GoalEntity goal, TaskEntity task) {
        this.goal = goal;
        this.task = task;
    }
}
