package pl.questtodo.category;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import pl.questtodo.user.CurrentUserProvider;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = "spring.datasource.url=jdbc:h2:mem:categories;MODE=PostgreSQL;DB_CLOSE_DELAY=-1")
@AutoConfigureMockMvc
@org.springframework.context.annotation.Import(pl.questtodo.AuthenticatedApiTestConfiguration.class)
@Transactional
class CategoryControllerTests {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @MockitoBean CurrentUserProvider currentUser;

    @BeforeEach
    void prepare() {
        jdbc.update("DELETE FROM categories");
        jdbc.update("DELETE FROM users WHERE id = 2");
        jdbc.update("INSERT INTO users(id, name, points) VALUES (2, 'Second user', 0)");
        when(currentUser.getUserId()).thenReturn(1L);
    }

    @Test
    void createsListsUpdatesAndDeletesOwnCategory() throws Exception {
        String created = mvc.perform(post("/api/categories").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"  Zdrowie  \",\"icon\":\"HEART\",\"color\":\"GREEN\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Zdrowie"))
                .andExpect(jsonPath("$.icon").value("HEART"))
                .andExpect(jsonPath("$.color").value("GREEN"))
                .andReturn().getResponse().getContentAsString();
        int id = com.jayway.jsonpath.JsonPath.read(created, "$.id");

        mvc.perform(get("/api/categories"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(id));
        mvc.perform(get("/api/categories/{id}", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Zdrowie"));
        mvc.perform(put("/api/categories/{id}", id).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Sport\",\"icon\":\"RUNNING\",\"color\":\"CYAN\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Sport"))
                .andExpect(jsonPath("$.icon").value("RUNNING"))
                .andExpect(jsonPath("$.color").value("CYAN"));
        mvc.perform(delete("/api/categories/{id}", id)).andExpect(status().isNoContent());
        mvc.perform(get("/api/categories")).andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void sortsCategoriesByNormalizedName() throws Exception {
        create("Praca", "BRIEFCASE", "BLUE");
        create("dom", "HOME", "AMBER");
        create("Finanse", "WALLET", "GREEN");

        mvc.perform(get("/api/categories"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("dom"))
                .andExpect(jsonPath("$[1].name").value("Finanse"))
                .andExpect(jsonPath("$[2].name").value("Praca"));
    }

    @Test
    void rejectsDuplicateNameForSameUserIgnoringCaseAndOuterWhitespace() throws Exception {
        create("Zdrowie", "HEART", "GREEN");
        mvc.perform(post("/api/categories").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"  ZDROWIE  \",\"icon\":\"LEAF\",\"color\":\"TEAL\"}"))
                .andExpect(status().isConflict());
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM categories WHERE user_id = 1", Integer.class));

        create("Praca", "BRIEFCASE", "BLUE");
        long workId = jdbc.queryForObject("SELECT id FROM categories WHERE name_key = 'praca'", Long.class);
        mvc.perform(put("/api/categories/{id}", workId).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"zdrowie\",\"icon\":\"BRIEFCASE\",\"color\":\"BLUE\"}"))
                .andExpect(status().isConflict());
        assertEquals("Praca", jdbc.queryForObject("SELECT name FROM categories WHERE id = ?", String.class, workId));

        when(currentUser.getUserId()).thenReturn(2L);
        create("zdrowie", "HEART", "PINK");
        assertEquals(3, jdbc.queryForObject("SELECT count(*) FROM categories", Integer.class));
    }

    @Test
    void rejectsInvalidCategoryData() throws Exception {
        for (String body : new String[]{
                "{\"name\":\"\",\"icon\":\"HEART\",\"color\":\"GREEN\"}",
                "{\"name\":\"Category\",\"color\":\"GREEN\"}",
                "{\"name\":\"Category\",\"icon\":\"HEART\"}",
                "{\"name\":\"Category\",\"icon\":\"UNKNOWN\",\"color\":\"GREEN\"}",
                "{\"name\":\"Category\",\"icon\":\"HEART\",\"color\":\"BLACK\"}",
                "{\"name\":\"" + "x".repeat(61) + "\",\"icon\":\"HEART\",\"color\":\"GREEN\"}"
        }) {
            mvc.perform(post("/api/categories").contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isBadRequest());
        }
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM categories", Integer.class));
    }

    @Test
    void hidesOtherUsersCategoriesAndProtectsMutations() throws Exception {
        jdbc.update("INSERT INTO categories(id, user_id, name, name_key, icon, color) VALUES "
                + "(1001, 1, 'Own', 'own', 'STAR', 'PURPLE'), "
                + "(2001, 2, 'Other', 'other', 'OTHER', 'RED')");

        mvc.perform(get("/api/categories"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].name").value("Own"));
        mvc.perform(get("/api/categories/2001")).andExpect(status().isNotFound());
        mvc.perform(put("/api/categories/2001").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Changed\",\"icon\":\"STAR\",\"color\":\"BLUE\"}"))
                .andExpect(status().isNotFound());
        mvc.perform(delete("/api/categories/2001")).andExpect(status().isNotFound());
        assertEquals("Other", jdbc.queryForObject("SELECT name FROM categories WHERE id = 2001", String.class));
    }

    private void create(String name, String icon, String color) throws Exception {
        mvc.perform(post("/api/categories").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"" + name + "\",\"icon\":\"" + icon
                                + "\",\"color\":\"" + color + "\"}"))
                .andExpect(status().isCreated());
    }
}
