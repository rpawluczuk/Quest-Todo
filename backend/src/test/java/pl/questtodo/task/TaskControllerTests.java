package pl.questtodo.task;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(TaskController.class)
@Import(TaskService.class)
class TaskControllerTests {

    @Autowired
    private MockMvc mockMvc;

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
