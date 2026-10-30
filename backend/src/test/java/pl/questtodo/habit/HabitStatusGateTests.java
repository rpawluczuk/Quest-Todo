package pl.questtodo.habit;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import pl.questtodo.user.CurrentUserProvider;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = "spring.datasource.url=jdbc:h2:mem:habit_status_gate;MODE=PostgreSQL;DB_CLOSE_DELAY=-1")
@AutoConfigureMockMvc
@org.springframework.context.annotation.Import(pl.questtodo.AuthenticatedApiTestConfiguration.class)
class HabitStatusGateTests {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @MockitoBean CurrentUserProvider currentUser;
    @BeforeEach void prepare() {
        when(currentUser.getUserId()).thenReturn(1L);
        jdbc.update("DELETE FROM habits");
    }
    @Test void waitingRoomIsNotExposedBeforeRewardAlgorithmsSupportIt() throws Exception {
        mvc.perform(post("/api/habits").contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Active\"}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.activityStatus").value("ACTIVE"));
        long id = jdbc.queryForObject("SELECT id FROM habits", Long.class);
        mvc.perform(patch("/api/habits/{id}/status", id).contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"ACTIVE\"}"))
                .andExpect(status().isOk());
        mvc.perform(patch("/api/habits/{id}/status", id).contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"PAUSED\"}"))
                .andExpect(status().isServiceUnavailable()).andExpect(jsonPath("$.detail").isNotEmpty());
        mvc.perform(post("/api/habits").contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Planned\",\"activityStatus\":\"PLANNED\"}"))
                .andExpect(status().isServiceUnavailable());
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM habits", Integer.class));
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM habit_status_periods", Integer.class));
        mvc.perform(get("/api/habits/{id}/status-history", id)).andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));
    }
}
