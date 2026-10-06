package pl.questtodo.email;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import pl.questtodo.user.CurrentUserProvider;

@RestController
public class EmailController {
    private final EmailService emails;
    private final CurrentUserProvider currentUser;
    public EmailController(EmailService emails, CurrentUserProvider currentUser) {
        this.emails = emails;
        this.currentUser = currentUser;
    }

    @GetMapping("/api/users/me/email")
    public EmailService.EmailStatus status() { return emails.status(currentUser.getUserId()); }

    @PostMapping("/api/users/me/email")
    public ResponseEntity<Void> change(@RequestBody ChangeEmail body) {
        emails.request(currentUser.getUserId(), body.email(), body.password(), false);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/api/users/me/email/resend")
    public ResponseEntity<Void> resend(@RequestBody ChangeEmail body) {
        emails.request(currentUser.getUserId(), null, body.password(), true);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/api/auth/email/confirm")
    public ResponseEntity<Void> confirm(@RequestBody Confirmation body) {
        emails.confirm(body.token());
        return ResponseEntity.noContent().build();
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Message> error(ResponseStatusException error) {
        return ResponseEntity.status(error.getStatusCode()).body(new Message(error.getReason()));
    }
    public record ChangeEmail(String email, String password) {}
    public record Confirmation(String token) {}
    public record Message(String message) {}
}
