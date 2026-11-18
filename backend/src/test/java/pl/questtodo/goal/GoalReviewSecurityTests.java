package pl.questtodo.goal;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class GoalReviewSecurityTests {
    @Autowired MockMvc mvc;

    @Test void reviewConfigurationAndJournalRequireAuthentication() throws Exception {
        mvc.perform(get("/api/goals")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/goals/1")).andExpect(status().isUnauthorized());
        mvc.perform(patch("/api/goals/1/completion").with(csrf()).contentType(MediaType.APPLICATION_JSON)
            .content("{\"completed\":false}")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/goals").with(csrf()).contentType(MediaType.APPLICATION_JSON)
            .content("{\"title\":\"Goal\",\"reviewFrequency\":\"MONTHLY\"}"))
            .andExpect(status().isUnauthorized());
        mvc.perform(put("/api/goals/1").with(csrf()).contentType(MediaType.APPLICATION_JSON)
            .content("{\"title\":\"Goal\",\"reviewFrequency\":\"WEEKLY\"}"))
            .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/goals/1/entries").with(csrf()).contentType(MediaType.APPLICATION_JSON)
            .content("{\"content\":\"Reflection\"}"))
            .andExpect(status().isUnauthorized());
    }
}
