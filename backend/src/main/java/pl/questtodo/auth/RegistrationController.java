package pl.questtodo.auth;

import java.nio.charset.StandardCharsets;
import java.util.Locale;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import pl.questtodo.user.UserEntity;
import pl.questtodo.user.UserRepository;

@RestController
public class RegistrationController {
    private final UserRepository users;
    private final PasswordEncoder passwords;

    public RegistrationController(UserRepository users, PasswordEncoder passwords) {
        this.users = users;
        this.passwords = passwords;
    }

    @PostMapping("/api/auth/register")
    public ResponseEntity<Message> register(@RequestBody Registration request) {
        String login = request.login() == null ? "" : request.login().strip().toLowerCase(Locale.ROOT);
        String password = request.password();
        if (!login.matches("[a-z0-9][a-z0-9._-]{2,63}")) {
            return ResponseEntity.badRequest().body(new Message("Login: 3–64 znaki (a–z, cyfry, kropka, podkreślenie lub myślnik). Pierwszy znak musi być literą lub cyfrą."));
        }
        if (password == null || password.length() < 8 || password.getBytes(StandardCharsets.UTF_8).length > 72) {
            return ResponseEntity.badRequest().body(new Message("Hasło musi mieć minimum 8 znaków i maksimum 72 bajty UTF-8."));
        }
        if (users.findByLogin(login).isPresent()) return duplicate();
        try {
            users.saveAndFlush(UserEntity.registered(login, passwords.encode(password)));
        } catch (DataIntegrityViolationException exception) {
            // The database unique constraint also handles simultaneous registrations.
            if (users.findByLogin(login).isPresent()) return duplicate();
            throw exception;
        }
        return ResponseEntity.status(201).body(new Message("Konto utworzone. Możesz się zalogować."));
    }

    private ResponseEntity<Message> duplicate() {
        return ResponseEntity.status(409).body(new Message("Ten login jest już zajęty. Wybierz inny."));
    }

    public record Registration(String login, String password) {}
    public record Message(String message) {}
}
