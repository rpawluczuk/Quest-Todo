package pl.questtodo.habit;

import java.time.LocalDate;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
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

    @Column(name = "created_on", nullable = false, updatable = false)
    private LocalDate createdOn;

    @Column(name = "reward_points", nullable = false)
    private int rewardPoints;

    public int getRewardPoints() { return rewardPoints; }
    public void setRewardPoints(int points) { this.rewardPoints = points; }

    protected HabitEntity() {}

    public HabitEntity(String name, UserEntity user, LocalDate createdOn) {
        this.name = name;
        this.user = user;
        this.createdOn = createdOn;
    }

    public void rename(String name) {
        this.name = name;
    }

    public Habit toHabit(boolean completed, HabitTarget target, HabitTarget latestTarget, long weeklyCompletedDays,
                         boolean weeklyRewardGranted) {
        return new Habit(id, name, createdOn, completed, target, latestTarget, weeklyCompletedDays, rewardPoints,
                weeklyRewardGranted);
    }

    public long getId() { return id; }

    public LocalDate getCreatedOn() {
        return createdOn;
    }
}
