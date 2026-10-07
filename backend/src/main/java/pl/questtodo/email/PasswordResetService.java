package pl.questtodo.email;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Base64;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import pl.questtodo.user.UserRepository;

@Service
public class PasswordResetService {
    private final JdbcTemplate jdbc;
    private final UserRepository users;
    private final PasswordEncoder passwords;
    private final EmailDelivery delivery;
    private final String publicUrl;

    public PasswordResetService(JdbcTemplate jdbc, UserRepository users, PasswordEncoder passwords,
            EmailDelivery delivery, @Value("${app.public-url:}") String publicUrl) {
        this.jdbc = jdbc;
        this.users = users;
        this.passwords = passwords;
        this.delivery = delivery;
        this.publicUrl = publicUrl.replaceAll("/+$", "");
    }

    @Transactional
    public void request(String address) {
        String email;
        try { email = EmailService.normalize(address); }
        catch (ResponseStatusException invalid) { return; }
        if (email == null) return;
        var ids = jdbc.query("SELECT user_id FROM account_email WHERE verified_email = ?",
                (rs, n) -> rs.getLong(1), email);
        if (ids.isEmpty()) return;
        var user = users.findForUpdate(ids.getFirst()).orElseThrow();
        jdbc.queryForObject("SELECT id FROM email_send_lock WHERE id = 1 FOR UPDATE", Integer.class);
        // Recheck after locking: the address may have changed while the request was waiting.
        if (jdbc.queryForObject("SELECT count(*) FROM account_email WHERE user_id = ? AND verified_email = ?",
                Integer.class, ids.getFirst(), email) == 0) return;
        var now = Instant.now();
        jdbc.update("DELETE FROM email_send_event WHERE sent_at < ?", Timestamp.from(now.minusSeconds(3600)));
        if (jdbc.queryForObject("SELECT count(*) FROM email_send_event", Integer.class) >= 30
                || jdbc.queryForObject("SELECT count(*) FROM email_send_event WHERE recipient_hash = ?", Integer.class, EmailService.hash(email)) >= 5
                || jdbc.queryForObject("SELECT count(*) FROM email_send_event WHERE user_id = ?", Integer.class, ids.getFirst()) >= 5
                || jdbc.queryForObject("SELECT count(*) FROM email_send_event WHERE user_id = ? AND sent_at > ?",
                        Integer.class, ids.getFirst(), Timestamp.from(now.minusSeconds(60))) > 0) return;
        try {
            var uri = URI.create(publicUrl);
            if (uri.getHost() == null || uri.getFragment() != null || uri.getQuery() != null
                    || !("https".equals(uri.getScheme()) || ("http".equals(uri.getScheme())
                    && java.util.Set.of("localhost", "127.0.0.1").contains(uri.getHost())))) return;
        } catch (IllegalArgumentException invalid) { return; }
        var bytes = new byte[32];
        new SecureRandom().nextBytes(bytes);
        var token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        try {
            delivery.send(email, "Quest Todo — ustaw nowe hasło",
                    "Aby ustawić nowe hasło, otwórz link:\n\n" + publicUrl + "/#reset-password=" + token
                    + "\n\nLink jest ważny 30 minut i działa jednorazowo. Jeśli nie proszono Cię o zmianę hasła, zignoruj tę wiadomość.",
                    UUID.randomUUID().toString());
        } catch (ConfiguredEmailDelivery.DeliveryUnavailable unavailable) { return; }
        jdbc.update("DELETE FROM password_reset WHERE expires_at <= ? OR user_id = ?", Timestamp.from(now), ids.getFirst());
        jdbc.update("INSERT INTO password_reset(user_id, token_hash, email, password_hash, expires_at) VALUES (?, ?, ?, ?, ?)",
                ids.getFirst(), EmailService.hash(token), email, user.getPasswordHash(), Timestamp.from(now.plusSeconds(1800)));
        jdbc.update("INSERT INTO email_send_event(user_id, recipient_hash, sent_at) VALUES (?, ?, ?)",
                ids.getFirst(), EmailService.hash(email), Timestamp.from(now));
    }

    @Transactional
    public long reset(String token, String password, String confirmation) {
        if (token == null || !token.matches("[A-Za-z0-9_-]{43}")) throw invalidLink();
        if (password == null || password.length() < 8 || password.getBytes(StandardCharsets.UTF_8).length > 72)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Hasło musi mieć minimum 8 znaków i maksimum 72 bajty UTF-8.");
        if (!password.equals(confirmation))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Hasła muszą być takie same.");
        var ids = jdbc.query("SELECT user_id FROM password_reset WHERE token_hash = ?", (rs, n) -> rs.getLong(1), EmailService.hash(token));
        if (ids.isEmpty()) throw invalidLink();
        long id = ids.getFirst();
        var user = users.findForUpdate(id).orElseThrow(PasswordResetService::invalidLink);
        jdbc.queryForObject("SELECT id FROM email_send_lock WHERE id = 1 FOR UPDATE", Integer.class);
        int valid = jdbc.queryForObject("SELECT count(*) FROM password_reset r JOIN account_email e ON e.user_id = r.user_id "
                + "WHERE r.user_id = ? AND r.token_hash = ? AND r.expires_at > ? AND r.email = e.verified_email AND r.password_hash = ?",
                Integer.class, id, EmailService.hash(token), Timestamp.from(Instant.now()), user.getPasswordHash());
        if (valid == 0) throw invalidLink();
        user.changePassword(passwords.encode(password));
        jdbc.update("DELETE FROM password_reset WHERE user_id = ?", id);
        // Pending email changes requested before account recovery must not survive it.
        jdbc.update("UPDATE account_email SET pending_email = NULL, token_hash = NULL, expires_at = NULL WHERE user_id = ?", id);
        return id;
    }

    private static ResponseStatusException invalidLink() {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, "Link jest nieprawidłowy, wygasł lub został już użyty. Poproś o nowy link.");
    }
}
