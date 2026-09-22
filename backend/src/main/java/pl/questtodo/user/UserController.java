package pl.questtodo.user;

import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/users/me")
public class UserController {
    private final UserService users;
    public UserController(UserService users) { this.users = users; }

    @GetMapping
    public UserEntity.User getCurrentUser() { return users.getCurrentUser(); }
}
