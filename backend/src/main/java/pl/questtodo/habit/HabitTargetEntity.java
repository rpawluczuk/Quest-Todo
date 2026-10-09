package pl.questtodo.habit;

import java.time.LocalDate;
import jakarta.persistence.*;

@Entity
@Table(name = "habit_targets", uniqueConstraints = @UniqueConstraint(columnNames = {"habit_id", "effective_from"}))
public class HabitTargetEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "habit_id", nullable = false)
    private HabitEntity habit;

    @Column(name = "target_days", nullable = false)
    private int targetDays;

    @Column(name = "effective_from", nullable = false)
    private LocalDate effectiveFrom;

    protected HabitTargetEntity() {}

    public HabitTargetEntity(HabitEntity habit, int targetDays, LocalDate effectiveFrom) {
        this.habit = habit;
        this.targetDays = targetDays;
        this.effectiveFrom = effectiveFrom;
    }

    public long getHabitId() { return habit.getId(); }
    public LocalDate getEffectiveFrom() { return effectiveFrom; }
    public int getTargetDays() { return targetDays; }
    public void changeTargetDays(int targetDays) { this.targetDays = targetDays; }
    public HabitTarget toTarget() { return new HabitTarget(targetDays, effectiveFrom); }
}
