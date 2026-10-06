package pl.questtodo.auth;

import java.nio.charset.StandardCharsets;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import pl.questtodo.user.UserRepository;

@Service
public class PasswordChangeService {
    private final UserRepository users;
    private final PasswordEncoder passwords;

    public PasswordChangeService(UserRepository users, PasswordEncoder passwords) {
        this.users = users;
        this.passwords = passwords;
    }

    @Transactional
    public void change(long userId, String currentPassword, String newPassword, String confirmation) {
        if (newPassword == null || newPassword.length() < 8
                || newPassword.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nowe hasło musi mieć minimum 8 znaków i maksimum 72 bajty UTF-8.");
        }
        if (!newPassword.equals(confirmation)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nowe hasła muszą być takie same.");
        }
        var user = users.findForUpdate(userId).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        if (currentPassword == null || currentPassword.getBytes(StandardCharsets.UTF_8).length > 72
                || !passwords.matches(currentPassword, user.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Obecne hasło jest nieprawidłowe.");
        }
        if (passwords.matches(newPassword, user.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nowe hasło musi różnić się od obecnego.");
        }
        user.changePassword(passwords.encode(newPassword));
    }
}
