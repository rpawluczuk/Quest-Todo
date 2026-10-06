package pl.questtodo.email;

import java.sql.Timestamp;
import java.time.Instant;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@EnableScheduling
public class EmailNotifications {
    private final JdbcTemplate jdbc;
    private final EmailDelivery delivery;
    public EmailNotifications(JdbcTemplate jdbc, EmailDelivery delivery) { this.jdbc = jdbc; this.delivery = delivery; }

    @Scheduled(fixedDelayString = "${app.mail.notification-delay:60000}")
    @Transactional
    public void deliver() {
        var due = jdbc.query("SELECT id, recipient FROM email_notification WHERE next_attempt_at <= ? ORDER BY created_at LIMIT 10 FOR UPDATE",
                (rs, n) -> new Notification(rs.getString(1), rs.getString(2)), Timestamp.from(Instant.now()));
        for (var notification : due) {
            try {
                delivery.send(notification.recipient(), "Quest Todo — zmieniono adres e-mail",
                        "Adres e-mail przypisany do Twojego konta Quest Todo został zmieniony. "
                        + "Jeśli to nie Twoja zmiana, zaloguj się dotychczasowym loginem, zmień hasło i sprawdź adres e-mail w menu konta.", notification.id());
                jdbc.update("DELETE FROM email_notification WHERE id = ?", notification.id());
            } catch (ConfiguredEmailDelivery.DeliveryUnavailable exception) {
                jdbc.update("UPDATE email_notification SET next_attempt_at = ? WHERE id = ?",
                        Timestamp.from(Instant.now().plusSeconds(600)), notification.id());
            }
        }
    }
    private record Notification(String id, String recipient) {}
}
