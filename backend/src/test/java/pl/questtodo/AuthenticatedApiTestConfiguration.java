package pl.questtodo;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.MockMvcBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

/** Existing domain tests exercise authenticated requests with valid CSRF tokens. */
@TestConfiguration
public class AuthenticatedApiTestConfiguration {
    @Bean
    MockMvcBuilderCustomizer authenticatedRequests() {
        return builder -> builder.defaultRequest(get("/").with(user("1")).with(csrf()));
    }
}
