package pl.questtodo.habit;

import pl.questtodo.goal.GoalEntryType;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "habit_entries")
public class HabitEntryEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "habit_id", nullable = false, updatable = false)
    private HabitEntity habit;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private GoalEntryType type;

    @Column(nullable = false, columnDefinition = "text")
    private String content;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected HabitEntryEntity() {}

    HabitEntryEntity(HabitEntity habit, GoalEntryType type, String content, Instant now) {
        this.habit = java.util.Objects.requireNonNull(habit);
        this.type = java.util.Objects.requireNonNull(type);
        this.content = content;
        this.createdAt = now;
        this.updatedAt = now;
    }

    void update(GoalEntryType type, String content, Instant now) {
        if (this.type == type && this.content.equals(content)) return;
        this.type = type;
        this.content = content;
        this.updatedAt = now;
    }

    GoalEntryType getType() { return type; }
    String getContent() { return content; }

    HabitEntryResponse toResponse() { return new HabitEntryResponse(id, type, content, createdAt, updatedAt); }
}
