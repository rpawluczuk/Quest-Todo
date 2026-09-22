package pl.questtodo.user;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class UserService {
    // Single local profile until authentication is introduced.
    public static final long CURRENT_USER_ID = 1L;
    private final UserRepository users;

    public UserService(UserRepository users) { this.users = users; }

    @Transactional(readOnly = true)
    public UserEntity.User getCurrentUser() {
        return users.findById(CURRENT_USER_ID).orElseThrow().toUser();
    }

    public UserEntity lockCurrentUser() {
        return users.findForUpdate(CURRENT_USER_ID).orElseThrow();
    }

    public UserEntity currentReference() { return users.getReferenceById(CURRENT_USER_ID); }
}
