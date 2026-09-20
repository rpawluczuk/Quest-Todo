package pl.questtodo.task;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Sql("/reset-tasks.sql")
class TaskControllerTests {

    @Autowired
    private MockMvc mockMvc;

    @ParameterizedTest
    @ValueSource(strings = {"completion", "focus"})
    void persistsStateAndRepeatedRequestsDoNotToggleIt(String endpoint) throws Exception {
        String field = endpoint.equals("completion") ? "completed" : "inFocus";
        String otherField = endpoint.equals("completion") ? "inFocus" : "completed";
        for (int attempt = 0; attempt < 2; attempt++) {
            mockMvc.perform(patch("/api/tasks/1/" + endpoint).contentType(MediaType.APPLICATION_JSON)
                            .content("{\"" + field + "\":true}"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$." + field).value(true))
                    .andExpect(jsonPath("$." + otherField).value(false))
                    .andExpect(jsonPath("$.points").value(20));
        }
        mockMvc.perform(get("/api/tasks"))
                .andExpect(jsonPath("$[0]." + field).value(true));
        if (endpoint.equals("completion")) {
            mockMvc.perform(patch("/api/tasks/1").contentType(MediaType.APPLICATION_JSON)
                            .content("{\"title\":\"Test\",\"points\":10}"))
                    .andExpect(status().isConflict());
        }
        mockMvc.perform(patch("/api/tasks/1/" + endpoint).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"" + field + "\":false}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$." + field).value(false));
    }

    @ParameterizedTest
    @ValueSource(strings = {"completion", "focus"})
    void rejectsMissingStateAndUnknownTask(String endpoint) throws Exception {
        String field = endpoint.equals("completion") ? "completed" : "inFocus";
        for (String body : new String[]{"{}", "{\"" + field + "\":null}"}) {
            mockMvc.perform(patch("/api/tasks/1/" + endpoint).contentType(MediaType.APPLICATION_JSON)
                            .content(body))
                    .andExpect(status().isBadRequest());
        }
        mockMvc.perform(patch("/api/tasks/999/" + endpoint).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"" + field + "\":true}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void updatesTaskAndPreservesOtherFields() throws Exception {
        mockMvc.perform(patch("/api/tasks/1").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"  Nowa nazwa  \",\"points\":25}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.title").value("Nowa nazwa"))
                .andExpect(jsonPath("$.points").value(25))
                .andExpect(jsonPath("$.completed").value(false))
                .andExpect(jsonPath("$.inFocus").value(false));
        mockMvc.perform(get("/api/tasks"))
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[0].title").value("Nowa nazwa"))
                .andExpect(jsonPath("$[0].points").value(25))
                .andExpect(jsonPath("$[1].points").value(15));
    }

    @Test
    void returnsNotFoundForMissingTask() throws Exception {
        mockMvc.perform(patch("/api/tasks/999").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Test\",\"points\":10}"))
                .andExpect(status().isNotFound());
    }

    @Test
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
        mockMvc.perform(patch("/api/tasks/1").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post("/api/tasks").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest());
        mockMvc.perform(get("/api/tasks"))
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[0].points").value(20));
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
