package pl.questtodo.habit;

import java.time.Instant;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "habit_status_periods")
public class HabitStatusPeriod {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "habit_id", nullable = false)
    private HabitEntity habit;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 16)
    private HabitStatus status;
    @Column(name = "started_at", nullable = false)
    private Instant startedAt;
    @Column(name = "ended_at")
    private Instant endedAt;
    @Column(name = "open_slot")
    private Integer openSlot;

    protected HabitStatusPeriod() {}
    public HabitStatusPeriod(HabitEntity habit, HabitStatus status, Instant startedAt) {
        this.habit = habit; this.status = status; this.startedAt = startedAt; this.openSlot = 1;
    }
    public Instant getStartedAt() { return startedAt; }
    public HabitStatus getStatus() { return status; }
    public void close(Instant at) { endedAt = at; openSlot = null; }
    public HabitStatusPeriodResponse toResponse() {
        return new HabitStatusPeriodResponse(status, startedAt, endedAt);
    }
}
