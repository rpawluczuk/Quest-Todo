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

    @Column(unique = true, length = 64)
    private String login;
    @Column(name = "password_hash", length = 100)
    private String passwordHash;

    protected UserEntity() {}

    public static UserEntity registered(String login, String passwordHash) {
        var user = new UserEntity();
        user.name = login;
        user.initializeCredentials(login, passwordHash);
        return user;
    }

    public long getPoints() { return points; }

    public String getLogin() { return login; }
    public String getPasswordHash() { return passwordHash; }

    public void initializeCredentials(String login, String passwordHash) {
        if (this.login != null || this.passwordHash != null) {
            throw new IllegalStateException("Account credentials are already initialized.");
        }
        this.login = login;
        this.passwordHash = passwordHash;
    }

    public void addPoints(long amount) { points = Math.addExact(points, amount); }

    public User toUser() { return new User(id, name, points, login); }

    public record User(long id, String name, long points, String login) {}
}
