package pl.questtodo;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class WebPageControllerTests {
    @Autowired MockMvc mvc;

    @Test void directLinksServeTheFrontendBeforeLoginWithoutOpeningTheApi() throws Exception {
        for (String path : new String[]{"/habits", "/habits/42/history?year=2025", "/goals", "/rewards"})
            mvc.perform(get(path)).andExpect(status().isOk()).andExpect(forwardedUrl("/index.html"));
        mvc.perform(get("/api/habits/42/history?year=2025")).andExpect(status().isUnauthorized());
        mvc.perform(get("/not-an-app-route")).andExpect(status().isUnauthorized());
    }
}
