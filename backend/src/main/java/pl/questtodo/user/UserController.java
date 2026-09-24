package pl.questtodo.user;

import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/users/me")
public class UserController {
    
    private final UserService userService;

    public UserController(UserService userService) { 
        this.userService = userService; 
    }

    @GetMapping
    public UserEntity.User getCurrentUser() { 
        return userService.getCurrentUser(); 
    }
}
