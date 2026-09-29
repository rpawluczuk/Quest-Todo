package pl.questtodo;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = "app.cors.allowed-origins=https://quest-frontend.example, https://second-frontend.example ")
@AutoConfigureMockMvc
class CorsTests {
    @Autowired MockMvc mvc;

    @ParameterizedTest
    @ValueSource(strings = {"https://quest-frontend.example", "https://second-frontend.example"})
    void allowsConfiguredOrigins(String origin) throws Exception {
        mvc.perform(get("/api/health").header("Origin", origin))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", origin))
                .andExpect(header().doesNotExist("Access-Control-Allow-Credentials"));
    }

    @ParameterizedTest
    @CsvSource({"POST,/api/rewards", "PATCH,/api/rewards/1", "DELETE,/api/tasks/1"})
    void permitsBrowserPreflightForMutations(String method, String path) throws Exception {
        mvc.perform(options(path)
                        .header("Origin", "https://quest-frontend.example")
                        .header("Access-Control-Request-Method", method)
                        .header("Access-Control-Request-Headers", "content-type"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "https://quest-frontend.example"))
                .andExpect(header().string("Access-Control-Allow-Headers", "content-type"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"https://other.example", "https://quest-frontend.example.evil.example", "null"})
    void rejectsUnconfiguredOrigins(String origin) throws Exception {
        mvc.perform(options("/api/rewards/1")
                        .header("Origin", origin)
                        .header("Access-Control-Request-Method", "PATCH"))
                .andExpect(status().isForbidden())
                .andExpect(header().doesNotExist("Access-Control-Allow-Origin"));
    }

    @Test
    void validationErrorsRemainReadableByFrontend() throws Exception {
        mvc.perform(patch("/api/rewards/1")
                        .header("Origin", "https://quest-frontend.example")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\" \",\"cost\":0}"))
                .andExpect(status().isBadRequest())
                .andExpect(header().string("Access-Control-Allow-Origin", "https://quest-frontend.example"))
                .andExpect(jsonPath("$.detail").isNotEmpty());
    }

    @Test
    void sameOriginRequestsStillWork() throws Exception {
        mvc.perform(get("/api/health"))
                .andExpect(status().isOk())
                .andExpect(header().doesNotExist("Access-Control-Allow-Origin"));
    }
}
