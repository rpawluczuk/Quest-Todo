package pl.questtodo.reward;

import java.sql.DriverManager;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class PurchaseMigrationTests {
    @Test
    void migrationPreservesLegacyPurchaseWithoutInventingDates() throws Exception {
        String url = "jdbc:h2:mem:purchase_migration;MODE=PostgreSQL;DB_CLOSE_DELAY=-1";
        Flyway.configure().dataSource(url, "sa", "").target("4").load().migrate();
        try (var connection = DriverManager.getConnection(url, "sa", "");
             var statement = connection.createStatement()) {
            statement.executeUpdate("INSERT INTO purchases (user_id, reward_id, title, cost) VALUES (1, 1, 'Stara nagroda', 20)");
            Flyway.configure().dataSource(url, "sa", "").load().migrate();
            try (var rows = statement.executeQuery("SELECT title, cost, purchased_at, used_at FROM purchases")) {
                assertTrue(rows.next());
                assertEquals("Stara nagroda", rows.getString("title"));
                assertEquals(20, rows.getInt("cost"));
                assertNull(rows.getObject("purchased_at"));
                assertNull(rows.getObject("used_at"));
                assertFalse(rows.next());
            }
        }
    }
}
