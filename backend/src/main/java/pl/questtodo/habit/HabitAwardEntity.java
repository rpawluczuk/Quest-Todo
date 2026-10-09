package pl.questtodo.habit;

import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "habit_weekly_awards")
public class HabitAwardEntity {
    @Id private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "habit_id", nullable = false)
    private HabitEntity habit;
    @Column(name = "week_start", nullable = false) private LocalDate weekStart;
    @Column(nullable = false) private int points;
    // Snapshot, deliberately not a foreign key: ordinary unchecking keeps the award.
    @Column(name = "completion_id", nullable = false) private long completionId;
    @Column(name = "completion_date", nullable = false) private LocalDate completionDate;
    @Column(name = "undo_until", nullable = false) private Instant undoUntil;

    protected HabitAwardEntity() {}
    public HabitAwardEntity(HabitEntity habit, LocalDate week, int points, long completionId,
                            LocalDate date, Instant now) {
        this.id = UUID.randomUUID();
        this.habit = habit;
        this.weekStart = week;
        this.points = points;
        this.completionId = completionId;
        this.completionDate = date;
        this.undoUntil = now.plusSeconds(8);
    }
    public long getCompletionId() { return completionId; }
    public LocalDate getCompletionDate() { return completionDate; }
    public Instant getUndoUntil() { return undoUntil; }
    public int getPoints() { return points; }
    public Award toAward() { return new Award(id, points, undoUntil); }
    public record Award(UUID id, int points, Instant undoUntil) {}
}
