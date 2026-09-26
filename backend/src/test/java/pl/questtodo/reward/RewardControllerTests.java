package pl.questtodo.reward;

import com.jayway.jsonpath.JsonPath;
import jakarta.persistence.EntityManager;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class RewardControllerTests {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private EntityManager entityManager;

    @Test
    @Sql("/reset-tasks.sql")
    void createsRewardAndReadsItFromDatabaseWithoutSpendingPoints() throws Exception {
        String created = mockMvc.perform(post("/api/rewards").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"  Wyjście do kina  \",\"cost\":120}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.title").value("Wyjście do kina"))
                .andExpect(jsonPath("$.cost").value(120))
                .andReturn().getResponse().getContentAsString();
        Number id = JsonPath.read(created, "$.id");
        entityManager.flush();
        entityManager.clear();
        mockMvc.perform(get("/api/rewards"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(4))
                .andExpect(jsonPath("$[3].id").value(id.intValue()))
                .andExpect(jsonPath("$[3].title").value("Wyjście do kina"))
                .andExpect(jsonPath("$[3].cost").value(120));
        mockMvc.perform(get("/api/users/me"))
                .andExpect(jsonPath("$.points").value(0));
        mockMvc.perform(get("/api/rewards/purchases"))
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    @Sql(statements = "UPDATE users SET points = 50")
    void newlyCreatedRewardCanBePurchased() throws Exception {
        String created = mockMvc.perform(post("/api/rewards").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Kawa\",\"cost\":15}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        Number id = JsonPath.read(created, "$.id");
        mockMvc.perform(post("/api/rewards/{id}/purchases", id.longValue()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.rewardId").value(id.intValue()))
                .andExpect(jsonPath("$.title").value("Kawa"))
                .andExpect(jsonPath("$.cost").value(15));
        mockMvc.perform(get("/api/users/me"))
                .andExpect(jsonPath("$.points").value(35));
    }

    @ParameterizedTest
    @ValueSource(ints = {1, 1001, Integer.MAX_VALUE})
    void acceptsPositiveCostsWithinDatabaseRange(int cost) throws Exception {
        mockMvc.perform(post("/api/rewards").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Nagroda\",\"cost\":" + cost + "}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.cost").value(cost));
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "{}",
            "{\"title\":\"   \",\"cost\":10}",
            "{\"title\":null,\"cost\":10}",
            "{\"cost\":10}",
            "{\"title\":\"Nagroda\"}",
            "{\"title\":\"Nagroda\",\"cost\":null}",
            "{\"title\":\"Nagroda\",\"cost\":0}",
            "{\"title\":\"Nagroda\",\"cost\":-1}",
            "{\"title\":\"Nagroda\",\"cost\":1.5}",
            "{\"title\":\"Nagroda\",\"cost\":2147483648}"
    })
    void rejectsInvalidRewardsWithoutSaving(String body) throws Exception {
        mockMvc.perform(post("/api/rewards").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.detail").isNotEmpty());
        mockMvc.perform(get("/api/rewards"))
                .andExpect(jsonPath("$.length()").value(3));
    }

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
