package pl.questtodo.habit;

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

    protected HabitEntity() {}

    public HabitEntity(String name, UserEntity user) {
        this.name = name;
        this.user = user;
    }

    public void rename(String name) {
        this.name = name;
    }

    public Habit toHabit() {
        return new Habit(id, name);
    }
}
