package pl.questtodo.user;

import org.springframework.web.bind.annotation.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

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

    @PutMapping("/theme")
    public UserEntity.User changeTheme(@Valid @RequestBody ThemeRequest request) {
        return userService.changeTheme(request.theme());
    }

    public record ThemeRequest(@NotNull UserTheme theme) {}
}
