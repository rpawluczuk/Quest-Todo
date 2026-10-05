package pl.questtodo.user;

import org.springframework.stereotype.Component;

@Component
public class CurrentUserProvider {
    // Preserve the existing account until authentication provides the user ID.
    public long getUserId() {
        return 1L;
    }
}
