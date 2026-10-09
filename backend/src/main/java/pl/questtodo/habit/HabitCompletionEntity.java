package pl.questtodo.habit;

import java.time.LocalDate;
import jakarta.persistence.*;

@Entity
@Table(name = "habit_completions", uniqueConstraints = @UniqueConstraint(columnNames = {"habit_id", "completion_date"}))
public class HabitCompletionEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "habit_id", nullable = false)
    private HabitEntity habit;

    @Column(name = "completion_date", nullable = false)
    private LocalDate date;

    protected HabitCompletionEntity() {}

    public long getId() { return id; }
    public LocalDate getDate() { return date; }

    public HabitCompletionEntity(HabitEntity habit, LocalDate date) {
        this.habit = habit;
        this.date = date;
    }
}
