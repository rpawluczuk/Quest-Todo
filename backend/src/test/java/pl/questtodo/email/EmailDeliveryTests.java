package pl.questtodo.email;

import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.env.MockEnvironment;
import static org.junit.jupiter.api.Assertions.*;

class EmailDeliveryTests {
    @TempDir Path mailbox;

    @Test
    void localFileDeliveryWritesMessageWithoutNetworkAndDoesNotDuplicateRetries() throws Exception {
        var environment = new MockEnvironment();
        environment.setActiveProfiles("local");
        var delivery = new ConfiguredEmailDelivery(environment, "file", "", "", mailbox.toString());
        delivery.send("user@example.com", "Subject", "Message", "test-message");
        delivery.send("user@example.com", "Subject", "Message", "test-message");
        assertTrue(Files.readString(mailbox.resolve("test-message.txt")).contains("Message"));
        try (var files = Files.list(mailbox)) { assertEquals(1, files.count()); }
    }

    @Test
    void fileModeCannotSilentlyReplaceProductionDeliveryAndResendNeedsCredentials() {
        var environment = new MockEnvironment();
        assertThrows(IllegalStateException.class, () -> new ConfiguredEmailDelivery(environment, "file", "", "", mailbox.toString()));
        assertThrows(IllegalStateException.class, () -> new ConfiguredEmailDelivery(environment, "resend", "", "", mailbox.toString()));
        var delivery = new ConfiguredEmailDelivery(environment, "disabled", "", "", mailbox.toString());
        assertThrows(ConfiguredEmailDelivery.DeliveryUnavailable.class, () -> delivery.send("user@example.com", "Subject", "Body", "test"));
    }
}
