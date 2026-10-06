package pl.questtodo.email;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {"spring.datasource.url=jdbc:h2:mem:emails;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
        "app.public-url=https://quest.example", "app.mail.notification-delay=3600000"})
@AutoConfigureMockMvc
@Import(EmailTests.Config.class)
class EmailTests {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired Mailbox mailbox;
    @Autowired EmailNotifications notifications;
    @Autowired EmailService emails;
    private static final String HASH = new BCryptPasswordEncoder(4).encode("password123");

    @TestConfiguration
    static class Config {
        @Bean @Primary Mailbox mailbox() { return new Mailbox(); }
    }
    static class Mailbox implements EmailDelivery {
        final List<Mail> sent = new CopyOnWriteArrayList<>();
        boolean fail;
        public void send(String to, String subject, String text, String id) {
            if (fail) throw new ConfiguredEmailDelivery.DeliveryUnavailable();
            sent.add(new Mail(to, subject, text));
        }
    }
    record Mail(String to, String subject, String text) {}

    @BeforeEach
    void reset() {
        jdbc.update("DELETE FROM email_notification");
        jdbc.update("DELETE FROM email_send_event");
        jdbc.update("DELETE FROM account_email");
        jdbc.update("DELETE FROM users WHERE id <> 1");
        jdbc.update("UPDATE users SET login = 'owner', password_hash = ? WHERE id = 1", HASH);
        mailbox.fail = false;
        mailbox.sent.clear();
    }

    @Test
    void existingAccountStaysIntactAndAddressRequiresSingleUseConfirmation() throws Exception {
        var before = jdbc.queryForMap("SELECT * FROM users WHERE id = 1");
        var session = login("owner");
        mvc.perform(get("/api/users/me/email").session(session)).andExpect(status().isOk())
                .andExpect(jsonPath("$.verifiedEmail").isEmpty()).andExpect(jsonPath("$.pendingEmail").isEmpty());
        change(session, " Owner@Example.com ", "password123").andExpect(status().isNoContent());
        String token = token();
        assertEquals("owner@example.com", mailbox.sent.getFirst().to());
        assertNotEquals(token, jdbc.queryForObject("SELECT token_hash FROM account_email WHERE user_id = 1", String.class));
        assertNull(emails.status(1).verifiedEmail());
        assertEquals("owner@example.com", emails.status(1).pendingEmail());
        confirm(token).andExpect(status().isNoContent());
        confirm(token).andExpect(status().isBadRequest());
        assertEquals("owner@example.com", emails.status(1).verifiedEmail());
        assertNull(emails.status(1).pendingEmail());
        assertNull(jdbc.queryForObject("SELECT token_hash FROM account_email WHERE user_id = 1", String.class));
        assertEquals(before, jdbc.queryForMap("SELECT * FROM users WHERE id = 1"));
    }

    @Test
    void replacementPreservesOldAddressUntilConfirmedAndQueuesNotification() throws Exception {
        var session = login("owner");
        change(session, "old@example.com", "password123").andExpect(status().isNoContent());
        confirm(token()).andExpect(status().isNoContent());
        advanceCooldown();
        change(session, "new@example.com", "password123").andExpect(status().isNoContent());
        assertEquals("old@example.com", emails.status(1).verifiedEmail());
        confirm(token()).andExpect(status().isNoContent());
        assertEquals("new@example.com", emails.status(1).verifiedEmail());
        mailbox.fail = true;
        notifications.deliver();
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM email_notification", Integer.class));
        mailbox.fail = false;
        jdbc.update("UPDATE email_notification SET next_attempt_at = ?", Timestamp.from(Instant.now().minusSeconds(1)));
        notifications.deliver();
        assertEquals("old@example.com", mailbox.sent.getLast().to());
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM email_notification", Integer.class));
    }

    @Test
    void resendInvalidatesPreviousTokenAndExpiryIsEnforced() throws Exception {
        var session = login("owner");
        change(session, "owner@example.com", "password123").andExpect(status().isNoContent());
        String previous = token();
        advanceCooldown();
        mvc.perform(post("/api/users/me/email/resend").session(session).with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"password\":\"password123\"}")).andExpect(status().isNoContent());
        confirm(previous).andExpect(status().isBadRequest());
        jdbc.update("UPDATE account_email SET expires_at = ?", Timestamp.from(Instant.now().minusSeconds(1)));
        confirm(token()).andExpect(status().isBadRequest());
        confirm("invalid").andExpect(status().isBadRequest());
        assertNull(emails.status(1).verifiedEmail());
    }

    @Test
    void mailFailureRollsBackPendingChangeAndKeepsPreviousLinkUsable() throws Exception {
        var session = login("owner");
        change(session, "first@example.com", "password123").andExpect(status().isNoContent());
        String previous = token();
        advanceCooldown();
        mailbox.fail = true;
        change(session, "different@example.com", "password123").andExpect(status().isServiceUnavailable());
        assertEquals("first@example.com", emails.status(1).pendingEmail());
        confirm(previous).andExpect(status().isNoContent());
    }

    @Test
    void passwordAuthenticationAndCsrfAreRequiredForAccountChanges() throws Exception {
        mvc.perform(get("/api/users/me/email")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/users/me/email").with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
        var session = login("owner");
        mvc.perform(post("/api/users/me/email").session(session).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isForbidden());
        change(session, "owner@example.com", "wrong").andExpect(status().isBadRequest());
        change(session, "invalid", "password123").andExpect(status().isBadRequest());
        mvc.perform(post("/api/auth/email/confirm").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isForbidden());
        assertTrue(mailbox.sent.isEmpty());
    }

    @Test
    void verifiedAddressIsUniqueEvenWhenTwoAccountsRequestItBeforeConfirmation() throws Exception {
        jdbc.update("INSERT INTO users(name, login, password_hash) VALUES ('Other', 'other', ?)", HASH);
        var owner = login("owner");
        var other = login("other");
        change(owner, "same@example.com", "password123").andExpect(status().isNoContent());
        String first = token();
        change(other, "same@example.com", "password123").andExpect(status().isNoContent());
        String second = token();
        confirm(first).andExpect(status().isNoContent());
        confirm(second).andExpect(status().isConflict());
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM account_email WHERE verified_email IS NOT NULL", Integer.class));
        assertEquals("same@example.com", emails.status(1).verifiedEmail());
    }

    @Test
    void cooldownAndHourlyLimitCoverChangingRecipients() throws Exception {
        var session = login("owner");
        for (int i = 0; i < 5; i++) {
            change(session, "owner" + i + "@example.com", "password123").andExpect(status().isNoContent());
            if (i == 0) change(session, "other@example.com", "password123").andExpect(status().isTooManyRequests());
            advanceCooldown();
        }
        change(session, "another@example.com", "password123").andExpect(status().isTooManyRequests());
        assertEquals(5, mailbox.sent.size());
    }

    @Test
    void registrationAllowsNoEmailAndReportsDeliveryFailureWithoutLosingAccount() throws Exception {
        mvc.perform(post("/api/auth/register").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"login\":\"demo\",\"password\":\"password123\"}" )).andExpect(status().isCreated());
        assertTrue(mailbox.sent.isEmpty());
        mvc.perform(post("/api/auth/register").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"login\":\"invalid\",\"password\":\"password123\",\"email\":\"invalid\"}" )).andExpect(status().isBadRequest());
        mailbox.fail = true;
        mvc.perform(post("/api/auth/register").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"login\":\"newuser\",\"password\":\"password123\",\"email\":\"new@example.com\"}" ))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("nie wysłano")));
        assertNotNull(login("newuser"));
    }

    @Test
    void registrationWithEmailAndConcurrentConfirmationUsesTokenOnce() throws Exception {
        mvc.perform(post("/api/auth/register").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"login\":\"newuser\",\"password\":\"password123\",\"email\":\"new@example.com\"}"))
                .andExpect(status().isCreated());
        String token = token();
        var start = new java.util.concurrent.CountDownLatch(1);
        try (var executor = java.util.concurrent.Executors.newFixedThreadPool(2)) {
            java.util.concurrent.Callable<Integer> confirm = () -> {
                start.await();
                try { emails.confirm(token); return 204; }
                catch (org.springframework.web.server.ResponseStatusException error) { return error.getStatusCode().value(); }
            };
            var first = executor.submit(confirm);
            var second = executor.submit(confirm);
            start.countDown();
            var results = new java.util.ArrayList<>(List.of(first.get(10, java.util.concurrent.TimeUnit.SECONDS), second.get(10, java.util.concurrent.TimeUnit.SECONDS)));
            results.sort(Integer::compareTo);
            assertEquals(List.of(204, 400), results);
        }
        var session = login("newuser");
        mvc.perform(get("/api/users/me/email").session(session).param("userId", "1"))
                .andExpect(jsonPath("$.verifiedEmail").value("new@example.com"));
        assertNull(emails.status(1).verifiedEmail());
    }

    @Test
    void recipientAndGlobalQuotasAlsoCoverNewAccounts() {
        for (int i = 0; i < 6; i++) {
            jdbc.update("INSERT INTO users(name, login, password_hash) VALUES ('Test', ?, ?)", "test" + i, HASH);
            long id = jdbc.queryForObject("SELECT id FROM users WHERE login = ?", Long.class, "test" + i);
            if (i < 5) emails.forRegistration(id, "shared@example.com");
            else assertEquals(429, assertThrows(org.springframework.web.server.ResponseStatusException.class,
                    () -> emails.forRegistration(id, "shared@example.com")).getStatusCode().value());
        }
        for (int i = 0; i < 25; i++) {
            jdbc.update("INSERT INTO email_send_event(user_id, recipient_hash, sent_at) VALUES (1, ?, ?)",
                    EmailService.hash("other" + i + "@example.com"), Timestamp.from(Instant.now()));
        }
        assertEquals(429, assertThrows(org.springframework.web.server.ResponseStatusException.class,
                () -> emails.forRegistration(1, "new@example.com")).getStatusCode().value());
        assertEquals(5, mailbox.sent.size());
    }

    private void advanceCooldown() {
        jdbc.update("UPDATE email_send_event SET sent_at = ?", Timestamp.from(Instant.now().minusSeconds(61)));
    }
    private String token() { return mailbox.sent.getLast().text().split("#verify-email=")[1].split("\\s")[0]; }
    private org.springframework.test.web.servlet.ResultActions confirm(String token) throws Exception {
        return mvc.perform(post("/api/auth/email/confirm").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"token\":\"" + token + "\"}"));
    }
    private org.springframework.test.web.servlet.ResultActions change(MockHttpSession session, String email, String password) throws Exception {
        return mvc.perform(post("/api/users/me/email").session(session).with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}"));
    }
    private MockHttpSession login(String login) throws Exception {
        var result = mvc.perform(post("/api/auth/login").with(csrf()).param("username", login).param("password", "password123"))
                .andExpect(status().isNoContent()).andReturn();
        return (MockHttpSession) result.getRequest().getSession(false);
    }
}
