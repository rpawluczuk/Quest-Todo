package pl.questtodo.task;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(TaskController.class)
@Import(TaskService.class)
class TaskControllerTests {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @DirtiesContext
    void createsTaskAndIncludesItInNextRead() throws Exception {
        mockMvc.perform(post("/api/tasks").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"  Trening  \",\"points\":15}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(4))
                .andExpect(jsonPath("$.title").value("Trening"))
                .andExpect(jsonPath("$.points").value(15))
                .andExpect(jsonPath("$.completed").value(false))
                .andExpect(jsonPath("$.inFocus").value(false));
        mockMvc.perform(post("/api/tasks").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Spacer\",\"points\":10}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(5));
        mockMvc.perform(get("/api/tasks"))
                .andExpect(jsonPath("$.length()").value(5))
                .andExpect(jsonPath("$[3].title").value("Trening"));
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "{\"title\":\"   \",\"points\":10}",
            "{\"points\":10}",
            "{\"title\":\"Test\"}",
            "{\"title\":\"Test\",\"points\":0}",
            "{\"title\":\"Test\",\"points\":-5}",
            "{\"title\":\"Test\",\"points\":1.5}",
            "{\"title\":\"Test\",\"points\":2147483648}"
    })
    void rejectsInvalidTasksWithoutSaving(String body) throws Exception {
        mockMvc.perform(post("/api/tasks").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest());
        mockMvc.perform(get("/api/tasks"))
                .andExpect(jsonPath("$.length()").value(3));
    }

    @Test
    void returnsTasksWithFieldsExpectedByFrontend() throws Exception {
        mockMvc.perform(get("/api/tasks"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(content().json("""
                        [
                          {"id":1,"title":"Poświęcić 20 minut na naukę Reacta","points":20,"completed":false,"inFocus":false},
                          {"id":2,"title":"Wybrać się na spacer","points":15,"completed":false,"inFocus":false},
                          {"id":3,"title":"Przeczytać rozdział książki","points":10,"completed":false,"inFocus":false}
                        ]
                        """));
    }
}
