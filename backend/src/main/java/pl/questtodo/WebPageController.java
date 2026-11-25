package pl.questtodo;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/** Client-side routes must also work when loaded directly from the shared-origin server. */
@Controller
public class WebPageController {
    @GetMapping({"/habits", "/habits/{id}/history", "/goals", "/rewards"})
    public String page() {
        return "forward:/index.html";
    }
}
