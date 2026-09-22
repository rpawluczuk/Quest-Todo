package pl.questtodo.user;

import jakarta.persistence.*;

@Entity
@Table(name = "users")
public class UserEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, columnDefinition = "text")
    private String name;
    @Column(nullable = false)
    private long points;

    protected UserEntity() {}

    public long getPoints() { return points; }

    public void addPoints(long amount) { points = Math.addExact(points, amount); }

    public User toUser() { return new User(id, name, points); }

    public record User(long id, String name, long points) {}
}
