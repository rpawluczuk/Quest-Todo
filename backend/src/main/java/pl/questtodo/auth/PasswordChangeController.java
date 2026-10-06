package pl.questtodo.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.session.SessionRegistry;
import org.springframework.security.web.authentication.logout.SecurityContextLogoutHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import pl.questtodo.user.CurrentUserProvider;

@RestController
public class PasswordChangeController {
    private final PasswordChangeService passwords;
    private final CurrentUserProvider currentUser;
    private final SessionRegistry sessions;

    public PasswordChangeController(PasswordChangeService passwords, CurrentUserProvider currentUser, SessionRegistry sessions) {
        this.passwords = passwords;
        this.currentUser = currentUser;
        this.sessions = sessions;
    }

    @PostMapping("/api/auth/password")
    public ResponseEntity<?> change(@RequestBody PasswordChange body, Authentication authentication,
            HttpServletRequest request, HttpServletResponse response) {
        try {
            passwords.change(currentUser.getUserId(), body.currentPassword(), body.newPassword(), body.confirmation());
        } catch (ResponseStatusException error) {
            return ResponseEntity.status(error.getStatusCode()).body(new Message(error.getReason()));
        }
        // The service transaction has committed before sessions are revoked.
        sessions.getAllSessions(authentication.getPrincipal(), false).forEach(session -> session.expireNow());
        new SecurityContextLogoutHandler().logout(request, response, authentication);
        return ResponseEntity.noContent().build();
    }

    public record PasswordChange(String currentPassword, String newPassword, String confirmation) {}
    public record Message(String message) {}
}
