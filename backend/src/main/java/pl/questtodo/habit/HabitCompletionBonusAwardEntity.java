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

    @Column(name = "ever_granted")
    private Boolean everGranted;

    @Column(name = "settled_on")
    private java.time.LocalDate settledOn;
    @Column(name = "successful_weeks")
    private Long successfulWeeks;
    @Column(name = "total_weeks")
    private Long totalWeeks;

    protected HabitCompletionBonusAwardEntity() {}

    public HabitCompletionBonusAwardEntity(long habitId, int points) {
        this.habitId = habitId;
        this.points = points;
        this.active = false;
        this.everGranted = false;
    }

    public int getPoints() { return points; }
    public boolean isActive() { return active; }
    public void activate() { active = true; everGranted = true; }
    public void deactivate() { active = false; }
    public Boolean getEverGranted() { return everGranted; }
    public boolean conditionsLocked() {
        return !Boolean.FALSE.equals(everGranted) || settledOn != null;
    }
    public void updateUnpaidPoints(int points) {
        if (!conditionsLocked()) this.points = points;
    }
    public java.time.LocalDate getSettledOn() { return settledOn; }
    public HabitRegularity regularity() {
        return settledOn == null ? null : HabitRegularity.of(successfulWeeks, totalWeeks);
    }
    public void settle(java.time.LocalDate today, HabitRegularity regularity) {
        if (settledOn == null) settledOn = today;
        successfulWeeks = regularity.successfulWeeks();
        totalWeeks = regularity.totalWeeks();
    }
}
