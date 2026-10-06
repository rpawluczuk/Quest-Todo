package pl.questtodo.email;

import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.env.MockEnvironment;
import tools.jackson.databind.ObjectMapper;
import static org.junit.jupiter.api.Assertions.*;

class EmailDeliveryTests {
    @TempDir Path mailbox;

    @Test
    void localFileDeliveryWritesMessageWithoutNetworkAndDoesNotDuplicateRetries() throws Exception {
        var environment = new MockEnvironment();
        environment.setActiveProfiles("local");
        var delivery = new ConfiguredEmailDelivery(environment, "file", "", "", "Quest Todo", mailbox.toString());
        delivery.send("user@example.com", "Subject", "Message", "test-message");
        delivery.send("user@example.com", "Subject", "Message", "test-message");
        assertTrue(Files.readString(mailbox.resolve("test-message.txt")).contains("Message"));
        try (var files = Files.list(mailbox)) { assertEquals(1, files.count()); }
    }

    @Test
    void fileModeCannotSilentlyReplaceProductionDeliveryAndBrevoNeedsCredentials() {
        var environment = new MockEnvironment();
        assertThrows(IllegalStateException.class, () -> new ConfiguredEmailDelivery(environment, "file", "", "", "Quest Todo", mailbox.toString()));
        assertThrows(IllegalStateException.class, () -> new ConfiguredEmailDelivery(environment, "brevo", "", "", "Quest Todo", mailbox.toString()));
        var delivery = new ConfiguredEmailDelivery(environment, "disabled", "", "", "Quest Todo", mailbox.toString());
        assertThrows(ConfiguredEmailDelivery.DeliveryUnavailable.class, () -> delivery.send("user@example.com", "Subject", "Body", "test"));
    }

    @Test
    void brevoDeliveryUsesVerifiedSenderAndIdempotencyKey() throws Exception {
        var body = new AtomicReference<String>();
        var apiKey = new AtomicReference<String>();
        var path = new AtomicReference<String>();
        var server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/v3/smtp/email", exchange -> {
            path.set(exchange.getRequestURI().getPath());
            apiKey.set(exchange.getRequestHeaders().getFirst("api-key"));
            body.set(new String(exchange.getRequestBody().readAllBytes()));
            exchange.sendResponseHeaders(201, -1);
            exchange.close();
        });
        server.start();
        try {
            var delivery = new ConfiguredEmailDelivery(new MockEnvironment(), "brevo", "secret-key",
                    "sender@example.com", "Quest Todo", mailbox.toString(),
                    "http://localhost:" + server.getAddress().getPort());

            delivery.send("user@example.com", "Subject", "Message", "d89bbdb6-40d7-4d81-b403-640b04050803");

            var json = new ObjectMapper().readTree(body.get());
            assertEquals("/v3/smtp/email", path.get());
            assertEquals("secret-key", apiKey.get());
            assertAll(
                    () -> assertEquals("Quest Todo", json.at("/sender/name").asText()),
                    () -> assertEquals("sender@example.com", json.at("/sender/email").asText()),
                    () -> assertEquals("user@example.com", json.at("/to/0/email").asText()),
                    () -> assertEquals("Message", json.path("textContent").asText()),
                    () -> assertEquals("d89bbdb6-40d7-4d81-b403-640b04050803", json.at("/headers/idempotencyKey").asText()));
        } finally {
            server.stop(0);
        }
    }
}
