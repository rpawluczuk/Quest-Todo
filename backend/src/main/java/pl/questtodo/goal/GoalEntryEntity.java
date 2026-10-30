package pl.questtodo.goal;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "goal_entries")
public class GoalEntryEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "goal_id", nullable = false, updatable = false)
    private GoalEntity goal;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private GoalEntryType type;

    @Column(nullable = false, columnDefinition = "text")
    private String content;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected GoalEntryEntity() {}

    GoalEntryEntity(GoalEntity goal, GoalEntryType type, String content, Instant now) {
        this.goal = java.util.Objects.requireNonNull(goal);
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

    GoalEntryResponse toResponse() { return new GoalEntryResponse(id, type, content, createdAt, updatedAt); }
}
