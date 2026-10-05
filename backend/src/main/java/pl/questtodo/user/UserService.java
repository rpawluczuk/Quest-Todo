package pl.questtodo.user;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class UserService {
    private final UserRepository users;
    private final CurrentUserProvider currentUser;

    public UserService(UserRepository users, CurrentUserProvider currentUser) {
        this.users = users;
        this.currentUser = currentUser;
    }

    @Transactional(readOnly = true)
    public UserEntity.User getCurrentUser() {
        return users.findById(currentUser.getUserId()).orElseThrow().toUser();
    }

    public UserEntity lockCurrentUser() {
        return users.findForUpdate(currentUser.getUserId()).orElseThrow();
    }

    public UserEntity currentReference() { return users.getReferenceById(currentUser.getUserId()); }
}
