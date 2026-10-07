package pl.questtodo.auth;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.session.SessionRegistry;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import pl.questtodo.email.PasswordResetService;

@RestController
public class PasswordResetController {
    private final PasswordResetService passwords;
    private final SessionRegistry sessions;
    public PasswordResetController(PasswordResetService passwords, SessionRegistry sessions) {
        this.passwords = passwords;
        this.sessions = sessions;
    }

    @PostMapping("/api/auth/password/forgot")
    public Message request(@RequestBody Request body) {
        passwords.request(body.email());
        return new Message("Jeśli adres jest potwierdzony przy koncie, otrzymasz link do ustawienia nowego hasła. Sprawdź także spam. Kolejną próbę podejmij za minutę.");
    }

    @PostMapping("/api/auth/password/reset")
    public ResponseEntity<?> reset(@RequestBody Reset body) {
        try {
            long id = passwords.reset(body.token(), body.password(), body.confirmation());
            // Revoke only this account's sessions, after the database transaction commits.
            sessions.getAllPrincipals().stream()
                    .filter(principal -> principal instanceof UserDetails user && user.getUsername().equals(Long.toString(id)))
                    .forEach(principal -> sessions.getAllSessions(principal, false).forEach(session -> session.expireNow()));
            return ResponseEntity.noContent().build();
        } catch (ResponseStatusException error) {
            return ResponseEntity.status(error.getStatusCode()).body(new Message(error.getReason()));
        }
    }
    public record Request(String email) {}
    public record Reset(String token, String password, String confirmation) {}
    public record Message(String message) {}
}
