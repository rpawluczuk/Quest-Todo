package pl.questtodo.auth;

import java.nio.charset.StandardCharsets;
import java.util.Locale;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import pl.questtodo.user.UserRepository;

@Component
public class ExistingAccountBootstrap implements ApplicationRunner {
    private final UserRepository users;
    private final PasswordEncoder passwords;
    private final String login;
    private final String password;

    public ExistingAccountBootstrap(UserRepository users, PasswordEncoder passwords,
            @Value("${app.bootstrap.login:}") String login,
            @Value("${app.bootstrap.password:}") String password) {
        this.users = users;
        this.passwords = passwords;
        this.login = login.strip().toLowerCase(Locale.ROOT);
        this.password = password;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments arguments) {
        if (login.isEmpty() && password.isEmpty()) return;
        var owner = users.findForUpdate(1L).orElseThrow();
        // Restarting or leaving these variables configured must never reset credentials.
        if (owner.getLogin() != null) return;
        if (!login.matches("[a-z0-9][a-z0-9._-]{2,63}")
                || password.length() < 8 || password.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new IllegalStateException("Pierwsze logowanie wymaga loginu o długości 3-64 znaków (a-z, 0-9, ., _, -) oraz hasła o długości co najmniej 8 znaków i najwyżej 72 bajtów UTF-8.");
        }
        owner.initializeCredentials(login, passwords.encode(password));
    }
}
