package pl.questtodo.email;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
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
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {"spring.datasource.url=jdbc:h2:mem:passwordreset;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
        "app.public-url=https://quest.example"})
@AutoConfigureMockMvc
@Import(PasswordResetTests.Config.class)
class PasswordResetTests {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordResetService service;
    @Autowired PasswordEncoder encoder;
    @Autowired Mailbox mailbox;
    @TestConfiguration static class Config {
        @Bean @Primary Mailbox mailbox() { return new Mailbox(); }
    }
    static class Mailbox implements EmailDelivery {
        List<String> messages = new ArrayList<>();
        boolean fail;
        public void send(String to, String subject, String text, String id) {
            if (fail) throw new ConfiguredEmailDelivery.DeliveryUnavailable();
            messages.add(text);
        }
    }
    @BeforeEach void prepare() {
        jdbc.update("DELETE FROM password_reset");
        jdbc.update("DELETE FROM email_send_event");
        jdbc.update("DELETE FROM account_email");
        jdbc.update("UPDATE users SET login = 'owner', password_hash = ? WHERE id = 1", encoder.encode("password123"));
        jdbc.update("INSERT INTO account_email(user_id, verified_email, pending_email) VALUES (1, 'owner@example.com', 'pending@example.com')");
        mailbox.messages.clear();
        mailbox.fail = false;
    }
    String token() { return mailbox.messages.getLast().split("#reset-password=")[1].split("\\s")[0]; }
    void cooldown() { jdbc.update("UPDATE email_send_event SET sent_at = ?", Timestamp.from(Instant.now().minusSeconds(61))); }

    @Test void publicEndpointRequiresCsrfAndDoesNotRevealAccounts() throws Exception {
        mvc.perform(post("/api/auth/password/forgot").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"owner@example.com\"}")).andExpect(status().isForbidden());
        String response = null;
        for (String email : List.of("missing@example.com", "pending@example.com", "owner@example.com")) {
            var body = mvc.perform(post("/api/auth/password/forgot").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                    .content("{\"email\":\"" + email + "\"}")).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
            if (response != null) assertEquals(response, body);
            response = body;
        }
        assertEquals(1, mailbox.messages.size());
    }
    @Test void resetIsSingleUsePreservesDataAndRevokesSession() throws Exception {
        var session = (org.springframework.mock.web.MockHttpSession) mvc.perform(post("/api/auth/login").with(csrf())
                .param("username", "owner").param("password", "password123")).andExpect(status().isNoContent())
                .andReturn().getRequest().getSession(false);
        var points = jdbc.queryForObject("SELECT points FROM users WHERE id = 1", Integer.class);
        service.request(" OWNER@example.com ");
        String token = token();
        assertNotEquals(token, jdbc.queryForObject("SELECT token_hash FROM password_reset WHERE user_id = 1", String.class));
        mvc.perform(post("/api/auth/password/reset").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"token\":\"" + token + "\",\"password\":\"new-password\",\"confirmation\":\"new-password\"}"))
                .andExpect(status().isNoContent());
        assertTrue(encoder.matches("new-password", jdbc.queryForObject("SELECT password_hash FROM users WHERE id = 1", String.class)));
        assertEquals(points, jdbc.queryForObject("SELECT points FROM users WHERE id = 1", Integer.class));
        assertThrows(org.springframework.web.server.ResponseStatusException.class, () -> service.reset(token, "another-pass", "another-pass"));
        mvc.perform(get("/api/users/me").session(session)).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/auth/login").with(csrf()).param("username", "owner").param("password", "password123")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/auth/login").with(csrf()).param("username", "owner").param("password", "new-password")).andExpect(status().isNoContent());
        assertNull(jdbc.queryForObject("SELECT pending_email FROM account_email WHERE user_id = 1", String.class));
    }
    @Test void cooldownReplacementExpiryAndValidation() {
        service.request("owner@example.com");
        String old = token();
        service.request("owner@example.com");
        assertEquals(1, mailbox.messages.size());
        cooldown();
        service.request("owner@example.com");
        String current = token();
        assertThrows(org.springframework.web.server.ResponseStatusException.class, () -> service.reset(old, "new-password", "new-password"));
        assertThrows(org.springframework.web.server.ResponseStatusException.class, () -> service.reset(current, "short", "short"));
        assertThrows(org.springframework.web.server.ResponseStatusException.class, () -> service.reset(current, "new-password", "different"));
        jdbc.update("UPDATE password_reset SET expires_at = ?", Timestamp.from(Instant.now().minusSeconds(1)));
        assertThrows(org.springframework.web.server.ResponseStatusException.class, () -> service.reset(current, "new-password", "new-password"));
    }
    @Test void changedEmailOrPasswordInvalidatesLink() {
        service.request("owner@example.com");
        String token = token();
        jdbc.update("UPDATE account_email SET verified_email = 'other@example.com' WHERE user_id = 1");
        assertThrows(org.springframework.web.server.ResponseStatusException.class, () -> service.reset(token, "new-password", "new-password"));
        jdbc.update("UPDATE account_email SET verified_email = 'owner@example.com' WHERE user_id = 1");
        jdbc.update("UPDATE users SET password_hash = ? WHERE id = 1", encoder.encode("changed-password"));
        assertThrows(org.springframework.web.server.ResponseStatusException.class, () -> service.reset(token, "new-password", "new-password"));
    }
    @Test void deliveryFailurePreservesPreviousTokenAndLimitsApply() {
        service.request("owner@example.com");
        String token = token();
        cooldown();
        mailbox.fail = true;
        service.request("owner@example.com");
        assertEquals(EmailService.hash(token), jdbc.queryForObject("SELECT token_hash FROM password_reset WHERE user_id = 1", String.class));
        mailbox.fail = false;
        for (int i = 0; i < 8; i++) { cooldown(); service.request("owner@example.com"); }
        assertEquals(5, mailbox.messages.size());
    }
}
