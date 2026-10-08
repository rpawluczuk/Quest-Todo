package pl.questtodo.email;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Locale;
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
public class EmailService {
    private final JdbcTemplate jdbc;
    private final UserRepository users;
    private final PasswordEncoder passwords;
    private final EmailDelivery delivery;
    private final String publicUrl;
    private final SecureRandom random = new SecureRandom();

    public EmailService(JdbcTemplate jdbc, UserRepository users, PasswordEncoder passwords,
            EmailDelivery delivery, @Value("${app.public-url:}") String publicUrl) {
        this.jdbc = jdbc;
        this.users = users;
        this.passwords = passwords;
        this.delivery = delivery;
        this.publicUrl = publicUrl.replaceAll("/+$", "");
    }

    public static String normalize(String email) {
        if (email == null || email.isBlank()) return null;
        String value = email.strip().toLowerCase(Locale.ROOT);
        // Deliberately support ordinary ASCII mailbox addresses; do not collapse dots or +aliases.
        if (value.length() > 254 || !value.matches("[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+")
                || value.indexOf('@') > 64) {
            throw error(400, "Podaj poprawny adres e-mail.");
        }
        return value;
    }

    public EmailStatus status(long id) {
        var rows = jdbc.query("SELECT verified_email, pending_email, expires_at FROM account_email WHERE user_id = ?",
                (rs, n) -> new EmailStatus(rs.getString(1), rs.getString(2),
                        rs.getTimestamp(3) == null ? null : rs.getTimestamp(3).toInstant()), id);
        return rows.isEmpty() ? new EmailStatus(null, null, null) : rows.getFirst();
    }

    @Transactional
    public void request(long id, String email, String password, boolean resend) {
        var user = users.findForUpdate(id).orElseThrow(() -> error(401, "Zaloguj się ponownie."));
        if (password == null || password.getBytes(StandardCharsets.UTF_8).length > 72
                || !passwords.matches(password, user.getPasswordHash())) throw error(400, "Obecne hasło jest nieprawidłowe.");
        issue(id, resend ? status(id).pendingEmail() : normalize(email));
    }

    // Only called with the newly created ID by the registration controller, never from a client-supplied ID.
    @Transactional
    public void forRegistration(long id, String email) {
        users.findForUpdate(id).orElseThrow();
        issue(id, normalize(email));
    }

    private void issue(long id, String email) {
        if (email == null) throw error(400, "Podaj adres e-mail.");
        URI uri;
        try { uri = URI.create(publicUrl); } catch (IllegalArgumentException exception) { throw error(503, "Wysyłanie wiadomości jest niedostępne."); }
        if (uri.getHost() == null || uri.getFragment() != null || uri.getQuery() != null
                || !("https".equals(uri.getScheme()) || ("http".equals(uri.getScheme()) && LOCAL_HOSTS.contains(uri.getHost())))) {
            throw error(503, "Wysyłanie wiadomości jest niedostępne.");
        }
        lockSending();
        var now = Instant.now();
        var hourAgo = Timestamp.from(now.minusSeconds(3600));
        jdbc.update("DELETE FROM email_send_event WHERE sent_at < ?", hourAgo);
        int global = jdbc.queryForObject("SELECT count(*) FROM email_send_event", Integer.class);
        int recipient = jdbc.queryForObject("SELECT count(*) FROM email_send_event WHERE recipient_hash = ?", Integer.class, hash(email));
        int account = jdbc.queryForObject("SELECT count(*) FROM email_send_event WHERE user_id = ?", Integer.class, id);
        int recent = jdbc.queryForObject("SELECT count(*) FROM email_send_event WHERE user_id = ? AND sent_at > ?",
                Integer.class, id, Timestamp.from(now.minusSeconds(60)));
        if (global >= 30 || recipient >= 5 || account >= 5 || recent > 0) throw error(429, "Zbyt wiele wysyłek. Odczekaj minutę; limit to 5 wiadomości na godzinę.");
        if (jdbc.queryForObject("SELECT count(*) FROM account_email WHERE verified_email = ?", Integer.class, email) > 0) {
            throw error(409, "Ten adres jest już potwierdzony przy koncie. Podaj inny.");
        }
        var bytes = new byte[32];
        random.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        if (jdbc.queryForObject("SELECT count(*) FROM account_email WHERE user_id = ?", Integer.class, id) == 0) {
            jdbc.update("INSERT INTO account_email(user_id) VALUES (?)", id);
        }
        jdbc.update("UPDATE account_email SET pending_email = ?, token_hash = ?, expires_at = ?, last_sent_at = ? WHERE user_id = ?",
                email, hash(token), Timestamp.from(now.plusSeconds(86400)), Timestamp.from(now), id);
        try {
            delivery.send(email, "Quest Todo — potwierdź adres e-mail",
                    "Aby potwierdzić adres e-mail, otwórz link i wybierz Potwierdź adres:\n\n" + publicUrl + "/#verify-email=" + token
                    + "\n\nLink jest ważny 24 godziny i działa jednorazowo. Jeśli nie proszono Cię o tę wiadomość, zignoruj ją.", UUID.randomUUID().toString());
        } catch (ConfiguredEmailDelivery.DeliveryUnavailable exception) {
            throw error(503, "Nie udało się wysłać wiadomości. Spróbuj ponownie później.");
        }
        jdbc.update("INSERT INTO email_send_event(user_id, recipient_hash, sent_at) VALUES (?, ?, ?)", id, hash(email), Timestamp.from(now));
    }

    @Transactional
    public void confirm(String token) {
        if (token == null || !token.matches("[A-Za-z0-9_-]{43}")) throw invalidLink();
        lockSending();
        var rows = jdbc.query("SELECT user_id, verified_email, pending_email, expires_at FROM account_email WHERE token_hash = ? FOR UPDATE",
                (rs, n) -> new Pending(rs.getLong(1), rs.getString(2), rs.getString(3), rs.getTimestamp(4).toInstant()), hash(token));
        if (rows.isEmpty() || !rows.getFirst().expires().isAfter(Instant.now())) throw invalidLink();
        var pending = rows.getFirst();
        if (jdbc.queryForObject("SELECT count(*) FROM account_email WHERE verified_email = ?", Integer.class, pending.email()) > 0) {
            throw error(409, "Adres został już przypisany do innego konta. Dodaj inny adres po zalogowaniu.");
        }
        jdbc.update("DELETE FROM password_reset WHERE user_id = ?", pending.id());
        jdbc.update("UPDATE account_email SET verified_email = pending_email, pending_email = NULL, token_hash = NULL, expires_at = NULL WHERE user_id = ?", pending.id());
        if (pending.previous() != null) {
            var now = Timestamp.from(Instant.now());
            jdbc.update("INSERT INTO email_notification(id, recipient, created_at, next_attempt_at, user_id) VALUES (?, ?, ?, ?, ?)",
                    UUID.randomUUID().toString(), pending.previous(), now, now, pending.id());
        }
    }

    private void lockSending() { jdbc.queryForObject("SELECT id FROM email_send_lock WHERE id = 1 FOR UPDATE", Integer.class); }
    private static final java.util.Set<String> LOCAL_HOSTS = java.util.Set.of("localhost", "127.0.0.1");
    private static ResponseStatusException invalidLink() { return error(400, "Link jest nieprawidłowy, wygasł lub został już użyty. Zaloguj się i wyślij nowy link."); }
    private static ResponseStatusException error(int status, String message) { return new ResponseStatusException(HttpStatus.valueOf(status), message); }
    static String hash(String value) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); }
        catch (java.security.NoSuchAlgorithmException exception) { throw new IllegalStateException(exception); }
    }
    public record EmailStatus(String verifiedEmail, String pendingEmail, Instant expiresAt) {}
    private record Pending(long id, String previous, String email, Instant expires) {}
}
