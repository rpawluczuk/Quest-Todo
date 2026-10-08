package pl.questtodo.user;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.session.SessionRegistry;
import org.springframework.security.web.authentication.logout.SecurityContextLogoutHandler;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
public class AccountDeletionController {
    private final AccountDeletionService accounts;
    private final CurrentUserProvider currentUser;
    private final SessionRegistry sessions;
    public AccountDeletionController(AccountDeletionService accounts, CurrentUserProvider currentUser, SessionRegistry sessions) {
        this.accounts = accounts;
        this.currentUser = currentUser;
        this.sessions = sessions;
    }

    @DeleteMapping("/api/users/me")
    public ResponseEntity<?> delete(@RequestBody Deletion body, Authentication authentication,
            HttpServletRequest request, HttpServletResponse response) {
        try {
            accounts.delete(currentUser.getUserId(), body.password(), body.loginConfirmation(), body.irreversibleConfirmation());
        } catch (ResponseStatusException error) {
            return ResponseEntity.status(error.getStatusCode()).body(new Message(error.getReason()));
        }
        // Service transaction committed successfully before revoking sessions.
        sessions.getAllSessions(authentication.getPrincipal(), false).forEach(session -> session.expireNow());
        new SecurityContextLogoutHandler().logout(request, response, authentication);
        return ResponseEntity.noContent().build();
    }
    public record Deletion(String password, String loginConfirmation, boolean irreversibleConfirmation) {
        @Override public String toString() { return "Deletion[redacted]"; }
    }
    public record Message(String message) {}
}
