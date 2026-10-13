package pl.questtodo.goal;

import jakarta.persistence.*;
import pl.questtodo.habit.HabitEntity;

@Entity
@Table(name = "goal_habits")
public class GoalHabitEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "goal_id", nullable = false)
    private GoalEntity goal;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "habit_id", nullable = false)
    private HabitEntity habit;

    protected GoalHabitEntity() {}

    public GoalHabitEntity(GoalEntity goal, HabitEntity habit) {
        this.goal = goal;
        this.habit = habit;
    }
}

