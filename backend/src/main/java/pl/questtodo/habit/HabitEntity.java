package pl.questtodo.habit;

import java.time.LocalDate;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import pl.questtodo.user.UserEntity;

@Entity
@Table(name = "habits")
public class HabitEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private UserEntity user;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(columnDefinition = "text")
    private String description;

    @Column(name = "created_on", nullable = false, updatable = false)
    private LocalDate createdOn;

    @Column(name = "reward_points", nullable = false)
    private int rewardPoints;

    public int getRewardPoints() { return rewardPoints; }
    public void setRewardPoints(int points) { this.rewardPoints = points; }

    @Column(name = "start_date")
    private LocalDate startDate;
    @Column(name = "end_date")
    private LocalDate endDate;
    @Column(name = "completion_limit")
    private Integer completionLimit;
    @Column(name = "ended_on")
    private LocalDate endedOn;
    @Enumerated(EnumType.STRING)
    @Column(name = "end_reason", length = 24)
    private HabitEndReason endReason;

    public LocalDate getStartDate() { return startDate == null ? createdOn : startDate; }
    public LocalDate getEndDate() { return endDate; }
    public Integer getCompletionLimit() { return completionLimit; }
    public LocalDate getEndedOn() { return endedOn; }
    public HabitEndReason getEndReason() { return endReason; }
    public void schedule(LocalDate start, LocalDate end, Integer limit) {
        startDate = start; endDate = end; completionLimit = limit;
    }
    public void end(LocalDate date, HabitEndReason reason) {
        endedOn = date;
        endReason = reason;
    }

    protected HabitEntity() {}

    public HabitEntity(String name, UserEntity user, LocalDate createdOn) {
        this.name = name;
        this.user = user;
        this.createdOn = createdOn;
    }

    public void rename(String name) {
        this.name = name;
    }

    public void changeDescription(String description) { this.description = description; }

    public Habit toHabit(boolean completed, HabitTarget target, HabitTarget latestTarget, long weeklyCompletedDays,
                         boolean weeklyRewardGranted, long totalCompletions, String status) {
        return new Habit(id, name, createdOn, completed, target, latestTarget, weeklyCompletedDays, rewardPoints,
                weeklyRewardGranted, description, getStartDate(), endDate, completionLimit, totalCompletions, status,
                endedOn, endReason, java.util.List.of(), java.util.List.of());
    }

    public long getId() { return id; }

    public LocalDate getCreatedOn() {
        return createdOn;
    }
}
