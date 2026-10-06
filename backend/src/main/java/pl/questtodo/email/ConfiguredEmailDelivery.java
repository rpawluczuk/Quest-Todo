package pl.questtodo.email;

import java.net.http.HttpClient;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.List;
import java.util.Map;
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
    private final Path directory;
    private final RestClient client;

    public ConfiguredEmailDelivery(Environment environment,
            @Value("${app.mail.mode:disabled}") String mode,
            @Value("${app.mail.api-key:}") String apiKey,
            @Value("${app.mail.from:}") String from,
            @Value("${app.mail.directory:.local-mail}") String directory) {
        this.mode = mode;
        this.apiKey = apiKey;
        this.from = from;
        this.directory = Path.of(directory);
        if (!List.of("disabled", "file", "resend").contains(mode)) throw new IllegalStateException("Unknown mail mode");
        if (mode.equals("file") && !environment.acceptsProfiles(Profiles.of("local"))) {
            throw new IllegalStateException("File mailbox requires the local profile");
        }
        if (mode.equals("resend") && (apiKey.isBlank() || from.isBlank())) {
            throw new IllegalStateException("Resend requires MAIL_API_KEY and MAIL_FROM");
        }
        var factory = new JdkClientHttpRequestFactory(HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build());
        factory.setReadTimeout(Duration.ofSeconds(10));
        client = RestClient.builder().requestFactory(factory).baseUrl("https://api.resend.com").build();
    }

    @Override
    public void send(String recipient, String subject, String text, String messageId) {
        try {
            if (mode.equals("file")) {
                Files.createDirectories(directory);
                Files.writeString(directory.resolve(messageId + ".txt"), "To: " + recipient + "\nSubject: " + subject + "\n\n" + text);
            } else if (mode.equals("resend")) {
                client.post().uri("/emails").header("Authorization", "Bearer " + apiKey)
                        .header("Idempotency-Key", messageId)
                        .body(Map.of("from", from, "to", List.of(recipient), "subject", subject, "text", text))
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
