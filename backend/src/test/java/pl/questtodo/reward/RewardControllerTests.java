package pl.questtodo.reward;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class RewardControllerTests {
    @Autowired
    private MockMvc mockMvc;

    @Test
    void returnsRewardsCreatedByMigration() throws Exception {
        mockMvc.perform(get("/api/rewards"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[0].id").value(1))
                .andExpect(jsonPath("$[0].title").value("Odcinek ulubionego serialu"))
                .andExpect(jsonPath("$[0].cost").value(20))
                .andExpect(jsonPath("$[1].cost").value(40))
                .andExpect(jsonPath("$[2].title").value("Wieczór filmowy"))
                .andExpect(jsonPath("$[2].cost").value(60));
    }

    @Test
    @Sql(statements = "DELETE FROM rewards")
    void returnsEmptyArrayWhenNoRewardsExist() throws Exception {
        mockMvc.perform(get("/api/rewards"))
                .andExpect(status().isOk())
                .andExpect(content().json("[]"));
    }
}
