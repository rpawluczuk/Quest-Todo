package pl.questtodo.user;

import java.nio.charset.StandardCharsets;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AccountDeletionService {
    private final UserRepository users;
    private final PasswordEncoder passwords;
    private final JdbcTemplate jdbc;

    public AccountDeletionService(UserRepository users, PasswordEncoder passwords, JdbcTemplate jdbc) {
        this.users = users;
        this.passwords = passwords;
        this.jdbc = jdbc;
    }

    @Transactional
    public void delete(long userId, String password, String loginConfirmation, boolean confirmed) {
        var user = users.findForUpdate(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        if (!confirmed || user.getLogin() == null || !user.getLogin().equals(loginConfirmation))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Przepisz dokładnie swój login i potwierdź trwałe usunięcie konta.");
        if (password == null || password.getBytes(StandardCharsets.UTF_8).length > 72
                || !passwords.matches(password, user.getPasswordHash()))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Obecne hasło jest nieprawidłowe.");

        // Same lock order as email requests and password resets: account, then mail lock.
        jdbc.queryForObject("SELECT id FROM email_send_lock WHERE id = 1 FOR UPDATE", Integer.class);
        jdbc.update("DELETE FROM purchases WHERE user_id = ?", userId);
        jdbc.update("DELETE FROM tasks WHERE user_id = ?", userId);
        jdbc.update("DELETE FROM rewards WHERE user_id = ?", userId);
        // Email state, reset tokens, send events and owned notifications cascade on deletion.
        jdbc.update("DELETE FROM users WHERE id = ?", userId);
    }
}
