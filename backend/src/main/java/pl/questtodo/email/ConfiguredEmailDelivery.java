package pl.questtodo.email;

import java.net.http.HttpClient;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Component
public class ConfiguredEmailDelivery implements EmailDelivery {
    private final String mode;
    private final String apiKey;
    private final String from;
    private final String fromName;
    private final Path directory;
    private final RestClient client;

    @Autowired
    public ConfiguredEmailDelivery(Environment environment,
            @Value("${app.mail.mode:disabled}") String mode,
            @Value("${app.mail.api-key:}") String apiKey,
            @Value("${app.mail.from:}") String from,
            @Value("${app.mail.from-name:Quest Todo}") String fromName,
            @Value("${app.mail.directory:.local-mail}") String directory) {
        this(environment, mode, apiKey, from, fromName, directory, "https://api.brevo.com");
    }

    ConfiguredEmailDelivery(Environment environment, String mode, String apiKey, String from,
            String fromName, String directory, String baseUrl) {
        this.mode = mode;
        this.apiKey = apiKey;
        this.from = from;
        this.fromName = fromName;
        this.directory = Path.of(directory);
        if (!List.of("disabled", "file", "brevo").contains(mode)) throw new IllegalStateException("Unknown mail mode");
        if (mode.equals("file") && !environment.acceptsProfiles(Profiles.of("local"))) {
            throw new IllegalStateException("File mailbox requires the local profile");
        }
        if (mode.equals("brevo") && (apiKey.isBlank() || from.isBlank() || fromName.isBlank())) {
            throw new IllegalStateException("Brevo requires MAIL_API_KEY, MAIL_FROM and MAIL_FROM_NAME");
        }
        var factory = new JdkClientHttpRequestFactory(HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build());
        factory.setReadTimeout(Duration.ofSeconds(10));
        client = RestClient.builder().requestFactory(factory).baseUrl(baseUrl).build();
    }

    @Override
    public void send(String recipient, String subject, String text, String messageId) {
        try {
            if (mode.equals("file")) {
                Files.createDirectories(directory);
                Files.writeString(directory.resolve(messageId + ".txt"), "To: " + recipient + "\nSubject: " + subject + "\n\n" + text);
            } else if (mode.equals("brevo")) {
                client.post().uri("/v3/smtp/email").header("api-key", apiKey)
                        .body(Map.of(
                                "sender", Map.of("email", from, "name", fromName),
                                "to", List.of(Map.of("email", recipient)),
                                "subject", subject,
                                "textContent", text,
                                "headers", Map.of("idempotencyKey", messageId)))
                        .retrieve().toBodilessEntity();
            } else {
                throw new IllegalStateException("Mail disabled");
            }
        } catch (Exception exception) {
            // Never expose provider response bodies, addresses, tokens or credentials in application errors.
            throw new DeliveryUnavailable();
        }
    }

    public static class DeliveryUnavailable extends RuntimeException {}
}
