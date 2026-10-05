package pl.questtodo.reward;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class RewardOwnershipMigrationTests {
    @Test
    void assignsExistingRewardsWithoutChangingAccountsTasksOrPurchaseHistory() throws Exception {
        String url = "jdbc:h2:mem:reward_ownership_migration;MODE=PostgreSQL;DB_CLOSE_DELAY=-1";
        Flyway.configure().dataSource(url, "sa", "").target("6").load().migrate();
        try (var connection = DriverManager.getConnection(url, "sa", "");
             var statement = connection.createStatement()) {
            statement.executeUpdate("UPDATE users SET points = -7 WHERE id = 1");
            statement.executeUpdate("UPDATE rewards SET deleted = TRUE WHERE id = 1");
            statement.executeUpdate("UPDATE tasks SET completed = TRUE, in_focus = TRUE, completed_at = CURRENT_TIMESTAMP WHERE id = 1");
            statement.executeUpdate("INSERT INTO purchases (user_id, reward_id, title, cost, purchased_at, used_at) VALUES (1, 1, 'Historical title', 17, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)");
            var usersBefore = rows(connection, "SELECT * FROM users ORDER BY id");
            var tasksBefore = rows(connection, "SELECT * FROM tasks ORDER BY id");
            var purchasesBefore = rows(connection, "SELECT * FROM purchases ORDER BY id");
            String oldRewardColumns = "SELECT id, title, cost, deleted FROM rewards ORDER BY id";
            var rewardsBefore = rows(connection, oldRewardColumns);

            Flyway.configure().dataSource(url, "sa", "").target("7").load().migrate();

            assertEquals(usersBefore, rows(connection, "SELECT * FROM users ORDER BY id"));
            assertEquals(tasksBefore, rows(connection, "SELECT * FROM tasks ORDER BY id"));
            assertEquals(purchasesBefore, rows(connection, "SELECT * FROM purchases ORDER BY id"));
            assertEquals(rewardsBefore, rows(connection, oldRewardColumns));
            assertEquals(List.of(List.of(1L), List.of(1L), List.of(1L)),
                    rows(connection, "SELECT user_id FROM rewards ORDER BY id"));

            // Both tables now require an explicit, existing owner.
            assertThrows(SQLException.class, () -> statement.executeUpdate(
                    "INSERT INTO rewards (title, cost) VALUES ('Missing owner', 10)"));
            assertThrows(SQLException.class, () -> statement.executeUpdate(
                    "INSERT INTO tasks (title, points) VALUES ('Missing owner', 10)"));
            assertThrows(SQLException.class, () -> statement.executeUpdate(
                    "INSERT INTO rewards (title, cost, user_id) VALUES ('Unknown owner', 10, 999)"));
            assertThrows(SQLException.class, () -> statement.executeUpdate(
                    "INSERT INTO tasks (title, points, user_id) VALUES ('Unknown owner', 10, 999)"));
            statement.executeUpdate("INSERT INTO users (id, name) VALUES (2, 'Second user')");
            assertEquals(1, statement.executeUpdate(
                    "INSERT INTO rewards (title, cost, user_id) VALUES ('Private reward', 10, 2)"));
            assertEquals(1, statement.executeUpdate(
                    "INSERT INTO tasks (title, points, user_id) VALUES ('Private task', 10, 2)"));
        }
    }

    private List<List<Object>> rows(Connection connection, String sql) throws SQLException {
        try (var statement = connection.createStatement(); var result = statement.executeQuery(sql)) {
            var rows = new ArrayList<List<Object>>();
            int columnCount = result.getMetaData().getColumnCount();
            while (result.next()) {
                var row = new ArrayList<Object>();
                for (int column = 1; column <= columnCount; column++) {
                    row.add(result.getObject(column));
                }
                rows.add(row);
            }
            return rows;
        }
    }
}
