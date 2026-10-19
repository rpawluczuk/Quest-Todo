package pl.questtodo.habit;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "habit_completion_bonus_awards")
public class HabitCompletionBonusAwardEntity {
    @Id
    @Column(name = "habit_id")
    private Long habitId;

    @Column(nullable = false)
    private int points;

    @Column(nullable = false)
    private boolean active;

    protected HabitCompletionBonusAwardEntity() {}

    public HabitCompletionBonusAwardEntity(long habitId, int points) {
        this.habitId = habitId;
        this.points = points;
        this.active = true;
    }

    public int getPoints() { return points; }
    public boolean isActive() { return active; }
    public void activate() { active = true; }
    public void deactivate() { active = false; }
}
